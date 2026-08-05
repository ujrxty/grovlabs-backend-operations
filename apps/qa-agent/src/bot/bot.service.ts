import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotCommandsService } from './bot-commands.service.js';
import axios from 'axios';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly authorizedChatId: string;
  private onboardingService: any = null; // lazy-loaded to avoid circular dep

  constructor(
    private readonly configService: ConfigService,
    private readonly commands: BotCommandsService,
  ) {
    this.authorizedChatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');
  }

  /** Lazy-load onboarding service to avoid circular dependency */
  private async getOnboardingService(): Promise<any> {
    if (!this.onboardingService) {
      // Dynamic import to avoid circular module dependency
      const mod = await import('../onboarding/onboarding.service.js');
      // Will be injected via setOnboardingService from the module
    }
    return this.onboardingService;
  }

  setOnboardingService(svc: any): void {
    this.onboardingService = svc;
  }


  async handleUpdate(update: any): Promise<void> {
    // Handle callback queries (inline button presses)
    if (update?.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    const message = update?.message;
    if (!message?.text) return;

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Security: only respond to authorized chat
    if (chatId !== this.authorizedChatId) {
      this.logger.warn(`Unauthorized chat: ${chatId}`);
      return;
    }

    this.logger.log(`Command received: ${text}`);

    try {
      await this.routeCommand(chatId, text);
    } catch (error: any) {
      this.logger.error(`Command error: ${error.message}`);
      await this.sendMessage(chatId, `Error: ${error.message}`);
    }
  }

  private async handleCallbackQuery(query: any): Promise<void> {
    const chatId = String(query.message?.chat?.id || '');
    const callbackId = query.id;
    const data = query.data || '';
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');

    // Security check
    if (chatId !== this.authorizedChatId) {
      this.logger.warn(`Unauthorized callback from chat: ${chatId}`);
      return;
    }

    this.logger.log(`Callback query: ${data}`);

    try {
      // Onboarding callbacks (oa_, or_, orr_, oaa_, ora_, orag_, ocs_, acs_)
      if (data.match(/^(oa_|or_|orr_|oaa_|ora_|orag_|ocs_|acs_)/)) {
        const onboarding = this.onboardingService;
        if (!onboarding) {
          await this.answerCallback(botToken, callbackId, 'Onboarding service not available');
          return;
        }
        const result = await onboarding.handleCallback(callbackId, data, chatId);
        if (result) {
          await this.sendMessage(chatId, result);
        }
        await this.answerCallback(botToken, callbackId, result ? 'Done' : 'Processing...');
      } else {
        await this.answerCallback(botToken, callbackId, 'Unknown action');
      }
    } catch (error: any) {
      this.logger.error(`Callback error: ${error.message}`);
      await this.answerCallback(botToken, callbackId, `Error: ${error.message.substring(0, 50)}`);
    }
  }

  private async answerCallback(botToken: string, callbackId: string, text: string): Promise<void> {
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        callback_query_id: callbackId,
        text: text.substring(0, 200),
      });
    } catch (e: any) {
      this.logger.error(`answerCallbackQuery failed: ${e.message}`);
    }
  }

  private async routeCommand(chatId: string, text: string): Promise<void> {
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase().replace('@.*$/', '');
    const args = parts.slice(1).join(' ').trim();

    switch (cmd) {
      case '/start':
      case '/help':
        await this.commands.handleHelp(chatId);
        break;
      // Analytics
      case '/overview':
        await this.commands.handleOverview(chatId);
        break;
      case '/stats':
        await this.commands.handleStats(chatId, args);
        break;
      case '/revenue':
        await this.commands.handleRevenue(chatId, args);
        break;
      case '/report':
        await this.commands.handleReport(chatId, args);
        break;
      // Scaling & Optimization
      case '/goal':
        await this.commands.handleGoal(chatId, args);
        break;
      case '/margins':
        await this.commands.handleMargins(chatId, args);
        break;
      // Automation
      case '/alerts':
        await this.commands.handleAlerts(chatId, args);
        break;
      // Vendors
      case '/vendors':
        await this.commands.handleVendorList(chatId);
        break;
      case '/pause':
        await this.commands.handlePause(chatId, args);
        break;
      case '/unpause':
        await this.commands.handleUnpause(chatId, args);
        break;
      case '/newvendor':
        await this.commands.handleNewVendor(chatId, args);
        break;
      // Offers
      case '/offers':
        await this.commands.handleOffers(chatId);
        break;
      // QA
      case '/flagged':
        await this.commands.handleFlagged(chatId, args);
        break;
      // Onboarding
      case '/applications':
        await this.commands.handleApplications(chatId, args);
        break;
      // RTB Monitor
      case '/rtbstats':
        await this.commands.handleRTBStats(chatId, args);
        break;

      default:
        await this.sendMessage(chatId, `Unknown command. Type /help for available commands.`);
    }
  }

  async sendMessage(chatId: string, text: string, parseMode = 'HTML'): Promise<void> {
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    if (!botToken) return;

    // Telegram 4096 char limit - split if needed
    const chunks = this.splitMessage(text, 4000);
    for (const chunk of chunks) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: chunk,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        });
      } catch (error: any) {
        this.logger.error(`Failed to send message: ${error.message}`);
      }
    }
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
