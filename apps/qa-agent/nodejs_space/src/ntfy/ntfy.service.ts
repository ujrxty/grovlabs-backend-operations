import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class NtfyService {
  private readonly logger = new Logger(NtfyService.name);
  private readonly baseUrl = 'https://ntfy.sh';

  constructor(private readonly config: ConfigService) {}

  private getTopic(): string {
    return this.config.get<string>('NTFY_TOPIC', 'grovlabs-calls');
  }

  async sendNotification(data: {
    title: string;
    message: string;
    priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
    tags?: string[];
    click?: string;
  }): Promise<boolean> {
    const topic = this.getTopic();
    if (!topic) {
      this.logger.debug('NTFY_TOPIC not configured, skipping notification');
      return false;
    }

    try {
      await axios.post(`${this.baseUrl}/${topic}`, data.message, {
        headers: {
          'Title': data.title,
          'Priority': data.priority || 'default',
          'Tags': (data.tags || []).join(','),
          ...(data.click ? { 'Click': data.click } : {}),
        },
      });
      this.logger.debug(`Ntfy notification sent: ${data.title}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Ntfy notification failed: ${err.message}`);
      return false;
    }
  }

  async sendLiveCallAlert(callData: {
    callId: string;
    callerNumber?: string;
    callerState?: string;
    offer?: string;
    trafficSource?: string;
    buyer?: string;
    duration?: number;
    revenue?: number;
  }): Promise<boolean> {
    const location = callData.callerState || 'Unknown';
    const offer = callData.offer || 'Unknown';
    const source = callData.trafficSource || 'Unknown';
    const buyer = callData.buyer || 'No buyer';
    const duration = callData.duration || 0;
    const revenue = callData.revenue || 0;

    const title = `📞 ${offer} - ${location}`;
    const lines = [
      `Source: ${source}`,
      `Buyer: ${buyer}`,
    ];

    if (duration > 0) {
      lines.push(`Duration: ${duration}s`);
    }
    if (revenue > 0) {
      lines.push(`Revenue: $${revenue.toFixed(2)}`);
    }

    return this.sendNotification({
      title,
      message: lines.join('\n'),
      priority: revenue > 50 ? 'high' : 'default',
      tags: ['phone_ringing', 'dollar'],
    });
  }
}
