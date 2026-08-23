import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordService } from '../discord/discord.service.js';

@Injectable()
export class StartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly discord: DiscordService,
  ) {}

  async onApplicationBootstrap() {
    const appOrigin = this.configService.get<string>('APP_ORIGIN', '');

    if (appOrigin) {
      const webhookUrl = new URL('/webhooks/trackdrive', appOrigin).toString();
      this.logger.log(`=== GROVLABS QA AGENT STARTED ===`);
      this.logger.log(`TrackDrive webhook URL: ${webhookUrl}`);
      this.logger.log(`Configure this URL as an Outgoing Webhook URL in TrackDrive dashboard`);
      this.logger.log(`Trigger type: call_ended or call_recording_updated_call_ended`);
    } else {
      this.logger.warn('APP_ORIGIN not set - running in dev mode');
    }

    // Send startup notification to Discord
    try {
      await this.discord.sendStartupNotification();
    } catch (e: any) {
      this.logger.warn(`Discord startup notification failed: ${e.message}`);
    }
  }
}
