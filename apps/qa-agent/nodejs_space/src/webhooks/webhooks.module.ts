import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller.js';
import { CallsModule } from '../calls/calls.module.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { NonConversionQaModule } from '../non-conversion-qa/non-conversion-qa.module.js';
import { DiscordModule } from '../discord/discord.module.js';

@Module({
  imports: [CallsModule, TrackDriveModule, NonConversionQaModule, DiscordModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
