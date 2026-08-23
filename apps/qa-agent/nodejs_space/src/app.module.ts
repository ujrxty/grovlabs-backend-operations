import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { SettingsModule } from './config/settings.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { TrackDriveModule } from './trackdrive/trackdrive.module.js';
import { TranscriptionModule } from './transcription/transcription.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';
import { TelegramModule } from './telegram/telegram.module.js';
import { DiscordModule } from './discord/discord.module.js';
import { CallsModule } from './calls/calls.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { AffiliatesModule } from './affiliates/affiliates.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { HealthModule } from './health/health.module.js';
import { StartupModule } from './startup/startup.module.js';
import { ReviewModule } from './review/review.module.js';
import { BotModule } from './bot/bot.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { CampaignMonitorModule } from './campaign-monitor/campaign-monitor.module.js';
import { VendorStatsModule } from './vendor-stats/vendor-stats.module.js';
import { SalesQaModule } from './sales-qa/sales-qa.module.js';
import { NonConversionQaModule } from './non-conversion-qa/non-conversion-qa.module.js';
import { QASettingsModule } from './qa-settings/qa-settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SettingsModule,
    JobsModule,
    TrackDriveModule,
    TranscriptionModule,
    AnalysisModule,
    TelegramModule,
    DiscordModule,
    CallsModule,
    WebhooksModule,
    AffiliatesModule,
    AnalyticsModule,
    HealthModule,
    StartupModule,
    ReviewModule,
    BotModule,
    OnboardingModule,
    CampaignMonitorModule,
    VendorStatsModule,
    SalesQaModule,
    NonConversionQaModule,
    QASettingsModule,
  ],
})
export class AppModule {}