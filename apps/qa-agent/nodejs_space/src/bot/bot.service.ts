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
      }
      // N2N partner application callbacks (n2na_ = approve, n2nr_ = reject)
      else if (data.match(/^n2n[ar]_/)) {
        const result = await this.handleN2NCallback(data);
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

  private async handleN2NCallback(data: string): Promise<string> {
    try {
      // Dynamic import to avoid circular dependency
      const { N2NApplicationService } = await import('../n2n/n2n-application.service.js');
      const { PrismaService } = await import('../prisma/prisma.service.js');
      const { TelegramService } = await import('../telegram/telegram.service.js');

      // We need to get the service instance - for now use prisma directly
      const prisma = new PrismaService();
      await prisma.onModuleInit();

      const shortId = data.slice(5); // Remove 'n2na_' or 'n2nr_'
      const isApprove = data.startsWith('n2na_');

      // Find application by short ID
      const apps = await prisma.network_partner_application.findMany({
        where: { id: { startsWith: shortId } },
      });

      if (apps.length === 0) {
        return `Application not found: ${shortId}`;
      }

      const app = apps[0];

      if (app.status !== 'pending') {
        return `Application already ${app.status}`;
      }

      if (isApprove) {
        // Create partner and update application
        const partner = await prisma.network_partner.create({
          data: {
            legal_name: app.company_name,
            organized_in: app.organized_in,
            contact_name: app.contact_name,
            contact_email: app.contact_email,
            contact_phone: app.contact_phone,
            address_line1: app.address_line1,
            address_line2: app.address_line2,
            can_buy: app.wants_to_buy,
            can_sell: app.wants_to_sell,
            notes: `Applied via website. Verticals: ${app.verticals || 'N/A'}`,
          },
        });

        await prisma.network_partner_application.update({
          where: { id: app.id },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: 'Telegram',
            partner_id: partner.id,
          },
        });

        return `✅ N2N Partner approved: ${app.company_name}\nPartner ID: ${partner.id.slice(0, 8)}`;
      } else {
        await prisma.network_partner_application.update({
          where: { id: app.id },
          data: {
            status: 'rejected',
            reviewed_at: new Date(),
            reviewed_by: 'Telegram',
          },
        });

        return `❌ N2N Partner rejected: ${app.company_name}`;
      }
    } catch (err: any) {
      this.logger.error(`N2N callback error: ${err.message}`);
      return `Error: ${err.message}`;
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
