import { Module, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { BotController } from './bot.controller.js';
import { BotService } from './bot.service.js';
import { BotCommandsService } from './bot-commands.service.js';
import { BotHelpersService } from './bot-helpers.service.js';
import { EODReportController } from './eod-report.controller.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { CampaignMonitorModule } from '../campaign-monitor/campaign-monitor.module.js';


@Module({
  imports: [TrackDriveModule, PrismaModule, TelegramModule, TranscriptionModule, forwardRef(() => OnboardingModule), CampaignMonitorModule],
  controllers: [BotController, EODReportController],
  providers: [BotService, BotCommandsService, BotHelpersService],
  exports: [BotService, BotCommandsService],
})
export class BotModule implements OnModuleInit {
  constructor(
    private readonly botService: BotService,
    @Inject(forwardRef(() => OnboardingService)) private readonly onboardingService: OnboardingService,
  ) {}

  onModuleInit() {
    this.botService.setOnboardingService(this.onboardingService);
  }
}
