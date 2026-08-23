import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface TelegramAlertPayload {
  callId: string;
  trackdriveCallId: string;
  callerNumber?: string;
  callerCity?: string;
  callerState?: string;
  affiliateName: string;
  campaignName: string;
  buyerName?: string;
  duration: number;
  detectedTriggers: string[];
  confidenceScore: number;
  aiSummary: string;
  recordingUrl: string;
  isHighSensitivity?: boolean;
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendAlert(payload: TelegramAlertPayload): Promise<boolean> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');

    if (!botToken || !chatId) {
      this.logger.warn('Telegram bot token or chat ID not configured');
      return false;
    }

    const sensitivityBadge = payload.isHighSensitivity ? '\n⚠️ <b>HIGH-SENSITIVITY MONITORED AFFILIATE</b>' : '';

    // Severity level with colored symbol
    let severityLabel: string;
    if (payload.confidenceScore >= 80) {
      severityLabel = '🔴 <b>CRITICAL</b>';
    } else if (payload.confidenceScore >= 60) {
      severityLabel = '🟠 <b>HIGH</b>';
    } else if (payload.confidenceScore >= 40) {
      severityLabel = '🟡 <b>MEDIUM</b>';
    } else {
      severityLabel = '🔵 <b>LOW</b>';
    }

    const callerLocation = [payload.callerCity, payload.callerState].filter(Boolean).join(', ');
    const callerLine = payload.callerNumber
      ? `📞 <b>Caller:</b> ${this.escapeHtml(payload.callerNumber)}${callerLocation ? ` (${this.escapeHtml(callerLocation)})` : ''}`
      : `📞 <b>Caller:</b> Unknown`;
    const buyerLine = payload.buyerName ? `\n🏢 <b>Buyer:</b> ${this.escapeHtml(payload.buyerName)}` : '';

    const message = `🤖 <b>QA AGENT NOTIFICATION</b>
${severityLabel}${sensitivityBadge}

${callerLine}
👤 <b>Affiliate:</b> ${this.escapeHtml(payload.affiliateName)}
📋 <b>Campaign:</b> ${this.escapeHtml(payload.campaignName)}${buyerLine}
⏱ <b>Duration:</b> ${payload.duration}s
📊 <b>Confidence:</b> ${payload.confidenceScore}%

🚩 <b>Detected Triggers:</b>
${payload.detectedTriggers.map((t) => `  • ${this.escapeHtml(t)}`).join('\n')}

📝 <b>AI Summary:</b>
${this.escapeHtml(payload.aiSummary)}

🔗 <a href="${payload.recordingUrl}">Listen to Recording</a>
🆔 TrackDrive Call ID: <code>${payload.trackdriveCallId}</code>`;

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      this.logger.log(`Telegram alert sent for call ${payload.trackdriveCallId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram alert: ${error.message}`);
      return false;
    }
  }

  async sendMessage(text: string): Promise<boolean> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');

    if (!botToken || !chatId) {
      this.logger.warn('Telegram bot token or chat ID not configured');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram message: ${error.message}`);
      return false;
    }
  }

  async sendStartupNotification(): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) return;

    const message = `✅ <b>GrovLabs QA Agent Online</b>\n\n🕐 ${new Date().toISOString()}\n🔍 Monitoring TrackDrive calls for cold transfers`;

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });
      this.logger.log('Startup notification sent to Telegram');
    } catch (error: any) {
      this.logger.warn(`Startup Telegram notification failed: ${error.message}`);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
