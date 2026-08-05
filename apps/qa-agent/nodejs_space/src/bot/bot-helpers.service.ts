import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import axios from 'axios';

@Injectable()
export class BotHelpersService {
  private readonly logger = new Logger(BotHelpersService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly td: TrackDriveService,
  ) {}

  async send(chatId: string, text: string): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    if (!botToken) return;

    const chunks = this.splitMessage(text, 4000);
    for (const chunk of chunks) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });
      } catch (error: any) {
        this.logger.error(`Send failed: ${error.response?.data?.description || error.message}`);
      }
    }
  }

  async findTrafficSource(query: string): Promise<any | null> {
    const data = await this.td.listTrafficSources({ per_page: 50 });
    const all = data?.traffic_sources || [];
    return all.find((ts: any) =>
      ts.name?.toLowerCase().includes(query.toLowerCase()) ||
      String(ts.id) === query ||
      ts.user_traffic_source_id === query
    ) || null;
  }

  esc(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  todayStr(): string {
    // PST (UTC-7)
    const now = new Date();
    const pst = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    return pst.toISOString().split('T')[0];
  }

  tomorrowStr(): string {
    const now = new Date();
    const pst = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    pst.setDate(pst.getDate() + 1);
    return pst.toISOString().split('T')[0];
  }

  parseRange(input: string): { from: string; to: string; label: string; days: number } {
    const now = new Date();
    const pst = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    const todayStr = pst.toISOString().split('T')[0];

    const tomorrow = new Date(pst);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    switch (input.toLowerCase()) {
      case 'week': {
        const weekAgo = new Date(pst);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { from: weekAgo.toISOString().split('T')[0], to: tomorrowStr, label: 'Past 7 days', days: 7 };
      }
      case '2weeks': {
        const twoWeeks = new Date(pst);
        twoWeeks.setDate(twoWeeks.getDate() - 14);
        return { from: twoWeeks.toISOString().split('T')[0], to: tomorrowStr, label: 'Past 2 weeks', days: 14 };
      }
      case 'month': {
        const monthAgo = new Date(pst);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return { from: monthAgo.toISOString().split('T')[0], to: tomorrowStr, label: 'Past 30 days', days: 30 };
      }
      case 'yesterday': {
        const yest = new Date(pst);
        yest.setDate(yest.getDate() - 1);
        return { from: yest.toISOString().split('T')[0], to: todayStr, label: 'Yesterday', days: 1 };
      }
      default:
        return { from: todayStr, to: tomorrowStr, label: 'Today', days: 1 };
    }
  }

  groupBy(items: any[], key: string): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    for (const item of items) {
      const val = item[key] || 'Unknown';
      if (!groups[val]) groups[val] = [];
      groups[val].push(item);
    }
    return groups;
  }

  groupByDate(calls: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    for (const c of calls) {
      const date = (c.created_at || '').split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(c);
    }
    return groups;
  }

  fmtDate(date: Date | string | null): string {
    if (!date) return '?';
    const d = new Date(date);
    return d.toISOString().replace('T', ' ').substring(0, 16);
  }

  /**
   * Smart call classification based on TrackDrive data patterns.
   * Returns: 'ivr_rejected' | 'ivr_failed' | 'no_answer' | 'answered' | 'converted'
   */
  classifyCall(call: any): string {
    if (call.buyer_converted === 'Converted') return 'converted';

    const dur = call.total_duration || 0;
    const answeredDur = call.answered_duration || 0;
    const hasBuyer = !!call.buyer;
    const hangup = (call.hangup_cause || '').toLowerCase();
    const buyerHungup = hangup.includes('buyer') && hangup.includes('hungup');

    // No buyer assigned or 0 answered duration with hold = never reached buyer
    if (!hasBuyer) return 'no_answer';
    if (answeredDur === 0 && dur > 0) return 'no_answer';

    // Very short buyer connection — IVR auto-rejection ("sorry we can't connect")
    // Pattern: buyer hung up, total ≤ 20s, short answered duration
    if (buyerHungup && dur <= 20) return 'ivr_rejected';

    // IVR failure zone — zip code entry fail, capacity cap, etc.
    // Pattern: 20-60s, not converted, buyer involved
    if (dur > 20 && dur <= 60 && hasBuyer) return 'ivr_failed';

    // Has buyer, decent duration, but not converted = actually answered
    if (hasBuyer && dur > 60) return 'answered';

    // Short calls where caller hung up during IVR
    if (dur <= 20 && !buyerHungup) return 'ivr_failed';

    // Default fallback
    return dur <= 30 ? 'ivr_failed' : 'answered';
  }

  classifyLabel(cls: string): string {
    const labels: Record<string, string> = {
      converted: 'Converted',
      answered: 'Answered',
      ivr_rejected: 'IVR Rejected',
      ivr_failed: 'IVR Failed',
      no_answer: 'No Answer',
    };
    return labels[cls] || cls;
  }

  classifyEmoji(cls: string): string {
    const emojis: Record<string, string> = {
      converted: '●',
      answered: '●',
      ivr_rejected: '●',
      ivr_failed: '●',
      no_answer: '●',
    };
    return emojis[cls] || '○';
  }

  /**
   * Classify all calls and return summary counts
   */
  classifyCalls(calls: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      converted: [],
      answered: [],
      ivr_rejected: [],
      ivr_failed: [],
      no_answer: [],
    };
    for (const c of calls) {
      const cls = this.classifyCall(c);
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(c);
    }
    return groups;
  }

  progressBar(pct: number, width = 10): string {
    const filled = Math.min(Math.round(pct / (100 / width)), width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  miniBar(value: number, max: number, width = 8): string {
    if (max === 0) return '░'.repeat(width);
    const filled = Math.min(Math.round((value / max) * width), width);
    return '▓'.repeat(filled) + '░'.repeat(width - filled);
  }

  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt < maxLen / 2) splitAt = maxLen;
      chunks.push(remaining.substring(0, splitAt));
      remaining = remaining.substring(splitAt);
    }
    return chunks;
  }
}
