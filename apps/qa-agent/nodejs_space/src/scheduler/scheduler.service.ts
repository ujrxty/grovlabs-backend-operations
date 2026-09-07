import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { VendorStatsService } from '../vendor-stats/vendor-stats.service.js';
import { NonConversionQaService } from '../non-conversion-qa/non-conversion-qa.service.js';
import { SalesQaService } from '../sales-qa/sales-qa.service.js';

export interface SchedulerSettings {
  enabled: boolean;
  timezone: string;
  vendor_stats_enabled: boolean;
  vendor_stats_hour: number;
  vendor_stats_minute: number;
  non_conversion_qa_enabled: boolean;
  non_conversion_qa_hour: number;
  non_conversion_qa_minute: number;
  sales_qa_enabled: boolean;
  sales_qa_hour: number;
  sales_qa_minute: number;
  discord_enabled: boolean;
  discord_webhook_url: string | null;
  email_enabled: boolean;
  email_recipients: string;
  telegram_enabled: boolean;
  last_vendor_stats_run: Date | null;
  last_non_conversion_run: Date | null;
  last_sales_qa_run: Date | null;
}

const DEFAULT_SETTINGS: SchedulerSettings = {
  enabled: false,
  timezone: 'America/Phoenix',
  vendor_stats_enabled: true,
  vendor_stats_hour: 18,
  vendor_stats_minute: 0,
  non_conversion_qa_enabled: true,
  non_conversion_qa_hour: 19,
  non_conversion_qa_minute: 0,
  sales_qa_enabled: true,
  sales_qa_hour: 20,
  sales_qa_minute: 0,
  discord_enabled: true,
  discord_webhook_url: null,
  email_enabled: true,
  email_recipients: 'uj@grovlabs.com',
  telegram_enabled: true,
  last_vendor_stats_run: null,
  last_non_conversion_run: null,
  last_sales_qa_run: null,
};

export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'UTC', label: 'UTC' },
];

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private checkInterval: NodeJS.Timeout | null = null;
  private settings: SchedulerSettings = DEFAULT_SETTINGS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendorStats: VendorStatsService,
    private readonly nonConversionQa: NonConversionQaService,
    private readonly salesQa: SalesQaService,
  ) {}

  async onModuleInit() {
    await this.loadSettings();

    this.logger.log('Scheduler starting - will check every 15 minutes');

    // Check every 15 minutes
    this.checkInterval = setInterval(() => this.checkAndRunTasks(), 15 * 60 * 1000);

    // Also run an initial check after 1 minute (let the app fully start)
    setTimeout(() => this.checkAndRunTasks(), 60 * 1000);
  }

  async loadSettings(): Promise<SchedulerSettings> {
    try {
      let row = await this.prisma.scheduler_settings.findUnique({
        where: { id: 'singleton' },
      });

      if (!row) {
        row = await this.prisma.scheduler_settings.create({
          data: { id: 'singleton' },
        });
      }

      this.settings = {
        enabled: row.enabled,
        timezone: row.timezone,
        vendor_stats_enabled: row.vendor_stats_enabled,
        vendor_stats_hour: row.vendor_stats_hour,
        vendor_stats_minute: row.vendor_stats_minute,
        non_conversion_qa_enabled: row.non_conversion_qa_enabled,
        non_conversion_qa_hour: row.non_conversion_qa_hour,
        non_conversion_qa_minute: row.non_conversion_qa_minute,
        sales_qa_enabled: row.sales_qa_enabled,
        sales_qa_hour: row.sales_qa_hour,
        sales_qa_minute: row.sales_qa_minute,
        discord_enabled: row.discord_enabled,
        discord_webhook_url: row.discord_webhook_url,
        email_enabled: row.email_enabled,
        email_recipients: row.email_recipients,
        telegram_enabled: row.telegram_enabled,
        last_vendor_stats_run: row.last_vendor_stats_run,
        last_non_conversion_run: row.last_non_conversion_run,
        last_sales_qa_run: row.last_sales_qa_run,
      };

      return this.settings;
    } catch (err: any) {
      this.logger.error(`Failed to load scheduler settings: ${err.message}`);
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(updates: Partial<SchedulerSettings>): Promise<SchedulerSettings> {
    await this.prisma.scheduler_settings.upsert({
      where: { id: 'singleton' },
      update: updates,
      create: { id: 'singleton', ...updates },
    });

    return this.loadSettings();
  }

  async getSettings(): Promise<SchedulerSettings> {
    return this.loadSettings();
  }

  private getTimeInTimezone(timezone: string): { hour: number; minute: number; dateStr: string } {
    const now = new Date();
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const minuteStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      minute: 'numeric',
    }).format(now);
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    return {
      hour: parseInt(hourStr, 10),
      minute: parseInt(minuteStr, 10),
      dateStr,
    };
  }

  private isSameDay(date1: Date | null, date2: Date, timezone: string): boolean {
    if (!date1) return false;
    const d1 = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date1);
    const d2 = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date2);
    return d1 === d2;
  }

  private isTimeToRun(targetHour: number, targetMinute: number, currentHour: number, currentMinute: number): boolean {
    // Check if we're within the 15-minute window of the target time
    const targetMins = targetHour * 60 + targetMinute;
    const currentMins = currentHour * 60 + currentMinute;
    return currentMins >= targetMins && currentMins < targetMins + 15;
  }

  private async checkAndRunTasks(): Promise<void> {
    await this.loadSettings();

    if (!this.settings.enabled) {
      this.logger.debug('Scheduler disabled, skipping check');
      return;
    }

    const { hour, minute, dateStr } = this.getTimeInTimezone(this.settings.timezone);
    const now = new Date();

    this.logger.log(`Scheduler check: ${this.settings.timezone} time=${hour}:${minute.toString().padStart(2, '0')}, date=${dateStr}`);

    // Vendor Stats
    if (
      this.settings.vendor_stats_enabled &&
      this.isTimeToRun(this.settings.vendor_stats_hour, this.settings.vendor_stats_minute, hour, minute) &&
      !this.isSameDay(this.settings.last_vendor_stats_run, now, this.settings.timezone)
    ) {
      this.logger.log('Triggering vendor daily stats emails...');
      try {
        const result = await this.vendorStats.runDailyStatsJob();
        await this.prisma.scheduler_settings.update({
          where: { id: 'singleton' },
          data: { last_vendor_stats_run: now },
        });
        this.logger.log(`Vendor stats complete: ${result.emailsSent} emails sent`);
      } catch (err: any) {
        this.logger.error(`Vendor stats failed: ${err.message}`);
      }
    }

    // Non-Conversion QA
    if (
      this.settings.non_conversion_qa_enabled &&
      this.isTimeToRun(this.settings.non_conversion_qa_hour, this.settings.non_conversion_qa_minute, hour, minute) &&
      !this.isSameDay(this.settings.last_non_conversion_run, now, this.settings.timezone)
    ) {
      this.logger.log('Triggering non-conversion QA review...');
      try {
        const result = await this.nonConversionQa.runDailyReview(dateStr);
        await this.prisma.scheduler_settings.update({
          where: { id: 'singleton' },
          data: { last_non_conversion_run: now },
        });
        this.logger.log(`Non-conversion QA complete: ${result.reviewed} reviewed`);
      } catch (err: any) {
        this.logger.error(`Non-conversion QA failed: ${err.message}`);
      }
    }

    // Sales QA
    if (
      this.settings.sales_qa_enabled &&
      this.isTimeToRun(this.settings.sales_qa_hour, this.settings.sales_qa_minute, hour, minute) &&
      !this.isSameDay(this.settings.last_sales_qa_run, now, this.settings.timezone)
    ) {
      this.logger.log('Triggering sales QA review...');
      try {
        const result = await this.salesQa.runDailyReview(dateStr);
        await this.prisma.scheduler_settings.update({
          where: { id: 'singleton' },
          data: { last_sales_qa_run: now },
        });
        this.logger.log(`Sales QA complete: ${result.reviewed} reviewed, ${result.sales} sales`);
      } catch (err: any) {
        this.logger.error(`Sales QA failed: ${err.message}`);
      }
    }
  }

  // Manual trigger methods for API access
  async triggerVendorStats(): Promise<any> {
    return this.vendorStats.runDailyStatsJob();
  }

  async triggerNonConversionQa(date?: string): Promise<any> {
    const { dateStr } = this.getTimeInTimezone(this.settings.timezone);
    return this.nonConversionQa.runDailyReview(date || dateStr);
  }

  async triggerSalesQa(date?: string): Promise<any> {
    const { dateStr } = this.getTimeInTimezone(this.settings.timezone);
    return this.salesQa.runDailyReview(date || dateStr);
  }

  getTimezoneOptions() {
    return TIMEZONE_OPTIONS;
  }
}
