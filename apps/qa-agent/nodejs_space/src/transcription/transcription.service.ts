import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Transcribe audio using OpenAI Whisper API, then format with GPT.
   */
  async transcribeAudio(audioBuffer: Buffer, fileName: string = 'recording.mp3'): Promise<string> {
    this.logger.log(`Transcribing audio file: ${fileName} (${audioBuffer.length} bytes)`);

    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');

    try {
      // Step 1: Transcribe with Whisper
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: fileName,
        contentType: fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
      });
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'text');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...formData.getHeaders(),
        },
        body: formData.getBuffer(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper API error (${response.status}): ${errorText}`);
      }

      const rawTranscript = await response.text();

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        throw new Error('Empty transcript received from Whisper API');
      }

      this.logger.log(`Raw transcription: ${rawTranscript.length} characters`);

      // Step 2: Format with GPT for readability
      const formatted = await this.formatTranscript(rawTranscript, apiKey);

      this.logger.log(`Formatted transcription: ${formatted.length} characters`);
      return formatted;
    } catch (error: any) {
      this.logger.error(`Transcription failed: ${error.message}`);
      throw error;
    }
  }

  private async formatTranscript(rawText: string, apiKey: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a transcript formatter. Format the raw phone call transcript into a clean, readable dialogue format.

Rules:
- Identify speakers and label them (e.g., "Agent:", "Caller:", or "IVR:" for automated messages)
- Put each speaker's turn on a new line
- Remove excessive filler sounds but keep natural speech patterns
- Keep the content accurate - do not change what was said
- Format phone ringing, hold music, etc. as [Phone ringing], [Hold music], etc.
- Return ONLY the formatted transcript, no commentary`,
            },
            {
              role: 'user',
              content: rawText,
            },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        this.logger.warn('Formatting failed, using raw transcript');
        return rawText;
      }

      const data = (await response.json()) as any;
      const formatted = data?.choices?.[0]?.message?.content?.trim();

      return formatted || rawText;
    } catch (error: any) {
      this.logger.warn(`Formatting error: ${error.message}, using raw transcript`);
      return rawText;
    }
  }
}
