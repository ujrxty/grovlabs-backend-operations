import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service.js';
import { OpenAIUsageModule } from '../openai-usage/openai-usage.module.js';

@Module({
  imports: [OpenAIUsageModule],
  providers: [TranscriptionService],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
