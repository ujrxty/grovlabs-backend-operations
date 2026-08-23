import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../config/settings.service';
import axios from 'axios';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly settingsService: SettingsService) {}

  private async getWebhookUrl(): Promise<string> {
    return this.settingsService.get('discordWebhookUrl');
  }

  private async getDashboardUrl(): Promise<string> {
    const url = await this.settingsService.get('dashboardUrl');
    return url || process.env.DASHBOARD_URL || 'http://localhost:3001';
  }

  async sendMessage(content: string): Promise<boolean> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) {
      this.logger.warn('Discord webhook URL not configured');
      return false;
    }

    try {
      await axios.post(webhookUrl, { content });
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Discord message: ${error.message}`);
      return false;
    }
  }

  async sendEmbed(embed: DiscordEmbed): Promise<boolean> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) {
      this.logger.warn('Discord webhook URL not configured');
      return false;
    }

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Discord embed: ${error.message}`);
      return false;
    }
  }

  async sendApplicationNotification(data: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    website?: string;
    trafficTypes: string;
    estimatedVolume?: string;
    referredBy?: string;
    experience?: string;
    comments?: string;
    campaigns: string[];
    applicationIds: string[];
    dashboardUrl?: string;
  }): Promise<boolean> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) {
      this.logger.warn('Discord webhook URL not configured');
      return false;
    }

    const dashboardUrl = data.dashboardUrl || await this.getDashboardUrl();
    const campaignList = data.campaigns.map(c => `• ${c}`).join('\n');

    const embed: DiscordEmbed = {
      title: '📋 New Vendor Application',
      color: 0xa3e635,
      fields: [
        { name: 'Company', value: data.companyName, inline: true },
        { name: 'Contact', value: data.contactName, inline: true },
        { name: 'Email', value: data.email, inline: true },
        { name: 'Phone', value: data.phone, inline: true },
        { name: 'Traffic Types', value: data.trafficTypes || 'Not specified', inline: true },
        { name: 'Est. Volume', value: data.estimatedVolume || 'Not specified', inline: true },
        { name: `Campaigns (${data.campaigns.length})`, value: campaignList || 'None', inline: false },
      ],
      footer: { text: 'GrovLabs QA Agent' },
      timestamp: new Date().toISOString(),
    };

    if (data.website) {
      embed.fields!.push({ name: 'Website', value: data.website, inline: true });
    }
    if (data.referredBy) {
      embed.fields!.push({ name: 'Referred By', value: data.referredBy, inline: true });
    }
    if (data.experience) {
      embed.fields!.push({ name: 'Experience', value: data.experience.substring(0, 200), inline: false });
    }
    if (data.comments) {
      embed.fields!.push({ name: 'Comments', value: data.comments.substring(0, 200), inline: false });
    }

    embed.fields!.push({
      name: 'Actions',
      value: `[View in Dashboard](${dashboardUrl}/applications)`,
      inline: false,
    });

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      this.logger.log(`Discord notification sent for application from ${data.companyName}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Discord notification: ${error.message}`);
      return false;
    }
  }

  async sendIOSignedNotification(data: {
    companyName: string;
    campaignName: string;
    ioNumber: string;
    dashboardUrl?: string;
  }): Promise<boolean> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) return false;

    const dashboardUrl = data.dashboardUrl || await this.getDashboardUrl();

    const embed: DiscordEmbed = {
      title: '✍️ IO Signed by Vendor',
      color: 0x3b82f6,
      fields: [
        { name: 'Company', value: data.companyName, inline: true },
        { name: 'Campaign', value: data.campaignName, inline: true },
        { name: 'IO Number', value: data.ioNumber, inline: true },
        { name: 'Action Required', value: `[Countersign in Dashboard](${dashboardUrl}/insertion-orders)`, inline: false },
      ],
      footer: { text: 'GrovLabs QA Agent' },
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      this.logger.log(`Discord IO signed notification sent for ${data.companyName}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Discord IO notification: ${error.message}`);
      return false;
    }
  }

  async sendAgreementSignedNotification(data: {
    companyName: string;
    dashboardUrl?: string;
  }): Promise<boolean> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) return false;

    const dashboardUrl = data.dashboardUrl || await this.getDashboardUrl();

    const embed: DiscordEmbed = {
      title: '📝 Lead Purchase Agreement Signed',
      color: 0x10b981,
      fields: [
        { name: 'Company', value: data.companyName, inline: true },
        { name: 'Action Required', value: `[Countersign in Dashboard](${dashboardUrl}/vendors)`, inline: false },
      ],
      footer: { text: 'GrovLabs QA Agent' },
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      this.logger.log(`Discord agreement signed notification sent for ${data.companyName}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Discord agreement notification: ${error.message}`);
      return false;
    }
  }

  async sendIOCountersignedNotification(data: {
    companyName: string;
    campaignName: string;
    ioNumber: string;
  }): Promise<boolean> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) return false;

    const embed: DiscordEmbed = {
      title: '✅ IO Countersigned & Active',
      color: 0x10b981,
      fields: [
        { name: 'Company', value: data.companyName, inline: true },
        { name: 'Campaign', value: data.campaignName, inline: true },
        { name: 'IO Number', value: data.ioNumber, inline: true },
      ],
      footer: { text: 'GrovLabs QA Agent' },
      timestamp: new Date().toISOString(),
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      this.logger.log(`Discord IO countersigned notification sent for ${data.companyName}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Discord IO countersigned notification: ${error.message}`);
      return false;
    }
  }

  async sendStartupNotification(): Promise<void> {
    const webhookUrl = await this.getWebhookUrl();
    if (!webhookUrl) return;

    const embed: DiscordEmbed = {
      title: '✅ GrovLabs QA Agent Online',
      color: 0xa3e635,
      description: 'Monitoring vendor applications and call quality.',
      footer: { text: new Date().toISOString() },
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      this.logger.log('Startup notification sent to Discord');
    } catch (error: any) {
      this.logger.warn(`Startup Discord notification failed: ${error.message}`);
    }
  }
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}
