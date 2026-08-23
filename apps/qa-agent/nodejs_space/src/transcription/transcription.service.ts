import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Transcribe audio using OpenAI Whisper API.
   */
  async transcribeAudio(audioBuffer: Buffer, fileName: string = 'recording.mp3'): Promise<string> {
    this.logger.log(`Transcribing audio file: ${fileName} (${audioBuffer.length} bytes)`);

    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');

    try {
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

      const transcript = await response.text();

      if (!transcript || transcript.trim().length === 0) {
        throw new Error('Empty transcript received from Whisper API');
      }

      this.logger.log(`Transcription completed: ${transcript.length} characters`);
      return transcript.trim();
    } catch (error: any) {
      this.logger.error(`Transcription failed: ${error.message}`);
      throw error;
    }
  }
}
