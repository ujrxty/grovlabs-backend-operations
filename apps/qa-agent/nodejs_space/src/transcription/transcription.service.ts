import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIUsageService } from '../openai-usage/openai-usage.service.js';
import { transcribeDetailed } from './detailed-transcribe.js';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usageService: OpenAIUsageService,
  ) {}

  /**
   * Transcribe audio using OpenAI Whisper API, then format with GPT.
   */
  async transcribeAudio(audioBuffer: Buffer, fileName: string = 'recording.mp3'): Promise<string> {
    this.logger.log(`Transcribing audio file: ${fileName} (${audioBuffer.length} bytes)`);

    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');

    try {
      // Step 1: Timestamped, speaker-labeled transcription (diarize model, whisper fallback)
      const tx = await transcribeDetailed(audioBuffer, apiKey);
      const rawTranscript = tx.dialogue;

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        throw new Error('Empty transcript received from transcription API');
      }

      // Log usage (both models bill per audio minute; estimate from file size)
      const estimatedMinutes = audioBuffer.length / (16000 * 2 * 60); // rough estimate
      await this.usageService.logUsage(tx.metrics.model, 0, 0, Math.max(0.1, estimatedMinutes));

      this.logger.log(
        `Transcription (${tx.metrics.model}): ${rawTranscript.length} chars, speakers=${tx.metrics.speakers}, turns=${tx.metrics.turns}`,
      );

      // Step 2: Map speaker letters to Agent/Caller/IVR roles for readability
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
- The input lines may be "[m:ss] Speaker X: text". Keep the [m:ss] timestamps, and replace "Speaker X" with a role label (e.g., "Agent:", "Caller:", or "IVR:" for automated messages), consistently per speaker
- If there are no speaker labels, identify speakers from context and label them the same way
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

      // Log GPT-4o-mini usage
      if (data?.usage) {
        await this.usageService.logUsage(
          'gpt-4o-mini',
          data.usage.prompt_tokens || 0,
          data.usage.completion_tokens || 0,
        );
      }

      return formatted || rawText;
    } catch (error: any) {
      this.logger.warn(`Formatting error: ${error.message}, using raw transcript`);
      return rawText;
    }
  }
}
