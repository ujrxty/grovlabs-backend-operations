import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIUsageController } from './openai-usage.controller.js';
import { OpenAIUsageService } from './openai-usage.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [OpenAIUsageController],
  providers: [OpenAIUsageService],
  exports: [OpenAIUsageService],
})
export class OpenAIUsageModule {}
