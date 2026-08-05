import { Module } from '@nestjs/common';
import { CampaignMonitorService } from './campaign-monitor.service.js';
import { CampaignMonitorController } from './campaign-monitor.controller.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [TrackDriveModule, TelegramModule, PrismaModule],
  controllers: [CampaignMonitorController],
  providers: [CampaignMonitorService],
  exports: [CampaignMonitorService],
})
export class CampaignMonitorModule {}
