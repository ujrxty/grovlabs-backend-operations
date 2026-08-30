import { Module } from '@nestjs/common';
import { AnalysisService } from './analysis.service.js';
import { OpenAIUsageModule } from '../openai-usage/openai-usage.module.js';

@Module({
  imports: [OpenAIUsageModule],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
