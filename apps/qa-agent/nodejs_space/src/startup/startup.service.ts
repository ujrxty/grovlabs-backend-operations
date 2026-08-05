import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from '../telegram/telegram.service.js';

@Injectable()
export class StartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telegram: TelegramService,
  ) {}

  async onApplicationBootstrap() {
    const appOrigin = this.configService.get<string>('APP_ORIGIN', '');

    if (appOrigin) {
      const webhookUrl = new URL('/webhooks/trackdrive', appOrigin).toString();
      this.logger.log(`=== BSBW QA AGENT STARTED ===`);
      this.logger.log(`TrackDrive webhook URL: ${webhookUrl}`);
      this.logger.log(`Configure this URL as an Outgoing Webhook URL in TrackDrive dashboard`);
      this.logger.log(`Trigger type: call_ended or call_recording_updated_call_ended`);
    } else {
      this.logger.warn('APP_ORIGIN not set - running in dev mode');
    }

    // Send startup notification to Telegram
    try {
      await this.telegram.sendStartupNotification();
    } catch (e: any) {
      this.logger.warn(`Telegram startup notification failed: ${e.message}`);
    }
  }
}
