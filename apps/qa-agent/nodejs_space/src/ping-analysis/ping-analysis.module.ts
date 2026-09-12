import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { PingAnalysisService } from './ping-analysis.service.js';
import { PingAnalysisController } from './ping-analysis.controller.js';
import { PingRelayService } from './ping-relay.service.js';
import { PingRelayController } from './ping-relay.controller.js';
import { AdvancedAnalyticsService } from './advanced-analytics.service.js';
import { AdvancedAnalyticsController } from './advanced-analytics.controller.js';

@Module({
  imports: [PrismaModule, TrackDriveModule],
  controllers: [PingAnalysisController, PingRelayController, AdvancedAnalyticsController],
  providers: [PingAnalysisService, PingRelayService, AdvancedAnalyticsService],
  exports: [PingAnalysisService, PingRelayService, AdvancedAnalyticsService],
})
export class PingAnalysisModule {}
