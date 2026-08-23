import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface QASettings {
  durationThresholds: Record<string, number>;
  normalConfidenceThreshold: number;
  highSensitivityConfidenceThreshold: number;
  primaryTriggers: string[];
  secondaryTriggers: string[];
  scheduleStartHour: number;
  scheduleEndHour: number;
  scheduleTimezone: string;
}

const DEFAULT_SETTINGS: QASettings = {
  durationThresholds: {
    'auto insurance': 120,
    'home insurance': 120,
    'solar': 120,
    'home improvement': 120,
    'plumbing': 120,
    'roofing': 120,
    'pest control': 120,
    'medicare': 300,
    default: 90,
  },
  normalConfidenceThreshold: 50,
  highSensitivityConfidenceThreshold: 30,
  primaryTriggers: [
    'you transferred me',
    'someone transferred me',
    'I was transferred',
    'you called me',
    'someone called me',
    "I didn't call you",
    "I didn't call this number",
    'stop calling me',
    'remove me from your list',
    'take me off your list',
    "I'm on the do not call list",
    'why are you calling me',
    'how did you get my number',
    'I never requested this',
    "I didn't ask for a quote",
    "I didn't fill out a form",
    'someone else called me',
    'a lady called me',
    'a guy called me',
    'a representative called',
    'you guys called me earlier',
    'I got a call from you',
    'I received a call',
    'put me back to the person',
    'transfer me back',
    'I want to talk to the first person',
    "where's the other person",
    'who was I talking to',
    'I was speaking to someone else',
    'who transferred me',
    'I was on the phone with someone',
    'the other person hung up',
    'why was I transferred',
    'I was already talking to someone',
    'the first person I spoke to',
    'they called me first',
    'I was cold transferred',
    'nobody told me about this transfer',
    'I did not consent to this call',
    'this is an unsolicited call',
    'you are calling me out of nowhere',
    'I never gave my number',
    'how did you get my information',
  ],
  secondaryTriggers: [
    'what company is this',
    'who are you people',
    'I have no idea why I am on this call',
    'this is a scam',
    'are you a scammer',
    'I am going to report you',
    'I will call the police',
    'do not call me again',
    'this is harassment',
    'leave me alone',
  ],
  scheduleStartHour: 8,
  scheduleEndHour: 18,
  scheduleTimezone: 'America/Los_Angeles',
};

@Injectable()
export class QASettingsService {
  private readonly logger = new Logger(QASettingsService.name);
  private cachedSettings: QASettings | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<QASettings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const result = await this.prisma.$queryRaw<{ settings_json: string }[]>`
        SELECT settings_json FROM system_settings WHERE key = 'qa_settings' LIMIT 1
      `;

      if (result && result[0]?.settings_json) {
        const dbSettings = JSON.parse(result[0].settings_json);
        const merged = { ...DEFAULT_SETTINGS, ...dbSettings };
        this.cachedSettings = merged;
        return merged;
      }
    } catch (error) {
      this.logger.warn('Failed to load QA settings from DB, using defaults');
    }

    return DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Partial<QASettings>): Promise<void> {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    const json = JSON.stringify(merged);

    try {
      await this.prisma.$executeRaw`
        INSERT INTO system_settings (key, settings_json, updated_at)
        VALUES ('qa_settings', ${json}::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET settings_json = ${json}::jsonb, updated_at = NOW()
      `;
      this.cachedSettings = merged;
      this.logger.log('QA settings saved to database');
    } catch (error: any) {
      this.logger.error(`Failed to save QA settings: ${error.message}`);
      throw error;
    }
  }

  clearCache(): void {
    this.cachedSettings = null;
  }

  // Helper methods for other services to use
  getDurationThreshold(campaignName: string): number {
    const settings = this.cachedSettings || DEFAULT_SETTINGS;
    const normalized = campaignName.toLowerCase();
    for (const [key, value] of Object.entries(settings.durationThresholds)) {
      if (key !== 'default' && normalized.includes(key)) {
        return value;
      }
    }
    return settings.durationThresholds.default || 90;
  }

  getNormalThreshold(): number {
    return (this.cachedSettings || DEFAULT_SETTINGS).normalConfidenceThreshold;
  }

  getHighSensitivityThreshold(): number {
    return (this.cachedSettings || DEFAULT_SETTINGS).highSensitivityConfidenceThreshold;
  }

  getPrimaryTriggers(): string[] {
    return (this.cachedSettings || DEFAULT_SETTINGS).primaryTriggers;
  }

  getSecondaryTriggers(): string[] {
    return (this.cachedSettings || DEFAULT_SETTINGS).secondaryTriggers;
  }

  getScheduleStartHour(): number {
    return (this.cachedSettings || DEFAULT_SETTINGS).scheduleStartHour;
  }

  getScheduleEndHour(): number {
    return (this.cachedSettings || DEFAULT_SETTINGS).scheduleEndHour;
  }

  getScheduleTimezone(): string {
    return (this.cachedSettings || DEFAULT_SETTINGS).scheduleTimezone;
  }
}
