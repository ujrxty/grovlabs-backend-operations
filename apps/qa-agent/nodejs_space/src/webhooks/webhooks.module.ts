import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { CallsModule } from '../calls/calls.module.js';

@Module({
  imports: [CallsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
