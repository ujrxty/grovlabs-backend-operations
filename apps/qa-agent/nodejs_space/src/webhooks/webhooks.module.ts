import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { CallsModule } from '../calls/calls.module.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';

@Module({
  imports: [CallsModule, TrackDriveModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
