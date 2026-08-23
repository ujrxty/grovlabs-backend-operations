import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SystemSettings {
  timezone: string;
  companyName: string;
  companyAddress: string;
  signatoryName: string;
  signatoryTitle: string;
  contactEmail: string;
  contactPhone: string;
  brandColor: string;
  smtpEnabled: boolean;
  smtpProvider: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFromEmail: string;
  smtpFromName: string;
  smtpSecure: boolean;
  openaiApiKey: string;
  trackdriveSubdomain: string;
  trackdrivePublicKey: string;
  trackdrivePrivateKey: string;
  discordWebhookUrl: string;
  vendorPortalUrl: string;
  dashboardUrl: string;
  qaAgentUrl: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  timezone: 'America/New_York',
  companyName: 'GrovLabs Inc',
  companyAddress: '8301 State Line Rd Ste 220, Kansas City, MO 64114',
  signatoryName: 'UJ',
  signatoryTitle: 'Chief Executive Officer',
  contactEmail: 'uj@grovlabs.com',
  contactPhone: '+1 (754) 344-0773',
  brandColor: '#8b5a2b',
  smtpEnabled: false,
  smtpProvider: 'gmail',
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFromEmail: '',
  smtpFromName: 'GrovLabs Inc',
  smtpSecure: true,
  openaiApiKey: '',
  trackdriveSubdomain: 'grovlabs',
  trackdrivePublicKey: '',
  trackdrivePrivateKey: '',
  discordWebhookUrl: '',
  vendorPortalUrl: '',
  dashboardUrl: '',
  qaAgentUrl: '',
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cachedSettings: SystemSettings | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<SystemSettings> {
    // Return cached if valid
    if (this.cachedSettings && Date.now() < this.cacheExpiry) {
      return this.cachedSettings;
    }

    try {
      const result = await this.prisma.$queryRaw<{ settings_json: string }[]>`
        SELECT settings_json FROM system_settings WHERE key = 'system_settings' LIMIT 1
      `;

      if (result && result[0]?.settings_json) {
        const dbSettings = JSON.parse(result[0].settings_json);
        this.cachedSettings = { ...DEFAULT_SETTINGS, ...dbSettings };
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
        return this.cachedSettings;
      }
    } catch (error) {
      this.logger.warn('Failed to load settings from DB, using defaults');
    }

    return DEFAULT_SETTINGS;
  }

  async get<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
    const settings = await this.getSettings();
    // Fallback to env var if setting is empty
    const value = settings[key];
    if (value === undefined || value === null || value === '') {
      const fallback = this.getEnvFallback(key);
      return (fallback || DEFAULT_SETTINGS[key]) as SystemSettings[K];
    }
    return value;
  }

  private getEnvFallback(key: keyof SystemSettings): string {
    const envMap: Partial<Record<keyof SystemSettings, string>> = {
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
      trackdrivePublicKey: process.env.TRACKDRIVE_PUBLIC_KEY || '',
      trackdrivePrivateKey: process.env.TRACKDRIVE_PRIVATE_KEY || '',
      trackdriveSubdomain: process.env.TRACKDRIVE_SUBDOMAIN || 'grovlabs',
      vendorPortalUrl: process.env.VENDOR_PORTAL_URL || '',
      dashboardUrl: process.env.DASHBOARD_URL || '',
      qaAgentUrl: process.env.QA_AGENT_URL || '',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      smtpHost: process.env.SMTP_HOST || '',
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
    };
    return envMap[key] || '';
  }

  clearCache() {
    this.cachedSettings = null;
    this.cacheExpiry = 0;
  }
}
