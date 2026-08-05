import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Transcribe audio using Abacus AI LLM API (Whisper-compatible).
   * Sends the audio as base64 to the LLM with a transcription prompt.
   */
  async transcribeAudio(audioBuffer: Buffer, fileName: string = 'recording.mp3'): Promise<string> {
    this.logger.log(`Transcribing audio file: ${fileName} (${audioBuffer.length} bytes)`);

    const apiKey = this.configService.get<string>('ABACUSAI_API_KEY', '');
    const base64Audio = audioBuffer.toString('base64');
    const mimeType = fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

    try {
      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  file: {
                    filename: fileName,
                    file_data: `data:${mimeType};base64,${base64Audio}`,
                  },
                },
                {
                  type: 'text',
                  text: 'Please transcribe this phone call recording word-for-word. Include all speakers and label them as Speaker 1, Speaker 2, etc. Capture everything said including hesitations, partial words, and background speech. Return ONLY the transcription text, no commentary.',
                },
              ],
            },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const transcript = data?.choices?.[0]?.message?.content?.trim();

      if (!transcript) {
        throw new Error('Empty transcript received from LLM API');
      }

      this.logger.log(`Transcription completed: ${transcript.length} characters`);
      return transcript;
    } catch (error: any) {
      this.logger.error(`Transcription failed: ${error.message}`);
      throw error;
    }
  }
}
