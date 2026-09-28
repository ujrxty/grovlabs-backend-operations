import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { VendorStatsModule } from '../vendor-stats/vendor-stats.module.js';
import { NonConversionQaModule } from '../non-conversion-qa/non-conversion-qa.module.js';
import { SalesQaModule } from '../sales-qa/sales-qa.module.js';
import { CampaignMonitorModule } from '../campaign-monitor/campaign-monitor.module.js';

@Module({
  imports: [PrismaModule, VendorStatsModule, NonConversionQaModule, SalesQaModule, CampaignMonitorModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
  exports: [SchedulerService],
})
export class SchedulerModule {}
