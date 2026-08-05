import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { CallsModule } from '../calls/calls.module.js';

@Module({
  imports: [CallsModule],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
