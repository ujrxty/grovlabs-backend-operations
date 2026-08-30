import { Module } from '@nestjs/common';
import { OpenAIUsageController } from './openai-usage.controller.js';
import { OpenAIUsageService } from './openai-usage.service.js';

@Module({
  controllers: [OpenAIUsageController],
  providers: [OpenAIUsageService],
  exports: [OpenAIUsageService],
})
export class OpenAIUsageModule {}
