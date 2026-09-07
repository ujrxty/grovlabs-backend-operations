import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { SchedulerController } from './scheduler.controller.js';
import { VendorStatsModule } from '../vendor-stats/vendor-stats.module.js';
import { NonConversionQaModule } from '../non-conversion-qa/non-conversion-qa.module.js';
import { SalesQaModule } from '../sales-qa/sales-qa.module.js';

@Module({
  imports: [VendorStatsModule, NonConversionQaModule, SalesQaModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
  exports: [SchedulerService],
})
export class SchedulerModule {}
