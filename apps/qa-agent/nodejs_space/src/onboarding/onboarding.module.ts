import { Module, forwardRef } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';
import { IOService } from './io.service.js';
import { OnboardingNotificationService } from './notification.service.js';
import { CampaignSyncService } from './campaign-sync.service.js';
import { VettingService } from './vetting.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { BotModule } from '../bot/bot.module.js';

@Module({
  imports: [PrismaModule, TrackDriveModule, forwardRef(() => BotModule)],
  controllers: [OnboardingController],
  providers: [OnboardingService, IOService, OnboardingNotificationService, CampaignSyncService, VettingService],
  exports: [OnboardingService, CampaignSyncService],
})
export class OnboardingModule {}
