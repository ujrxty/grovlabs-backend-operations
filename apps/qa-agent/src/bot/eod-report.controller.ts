import { Controller, Post, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BotCommandsService } from './bot-commands.service.js';
import { BotHelpersService } from './bot-helpers.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';

@ApiTags('Reports')
@Controller('api/reports')
export class EODReportController {
  private readonly logger = new Logger(EODReportController.name);

  constructor(
    private readonly commands: BotCommandsService,
    private readonly helpers: BotHelpersService,
    private readonly configService: ConfigService,
    private readonly td: TrackDriveService,
  ) {}

  @Post('eod')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger end-of-day report', description: 'Generates and sends the daily EOD report to Telegram. Called by cron at 5pm PST.' })
  @ApiResponse({ status: 200, description: 'EOD report sent' })
  async triggerEOD() {
    this.logger.log('EOD report triggered');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');
    if (!chatId) {
      return { status: 'error', message: 'No chat ID configured' };
    }

    try {
      const report = await this.commands.buildEODReport();
      await this.helpers.send(chatId, report);
      return { status: 'sent', message: 'EOD report delivered to Telegram' };
    } catch (error: any) {
      this.logger.error(`EOD report failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @Post('monthly')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger monthly report', description: 'Generates payouts/revenue report for the past month for invoicing. Runs async and sends result to Telegram.' })
  @ApiResponse({ status: 200, description: 'Monthly report generation started' })
  async triggerMonthly() {
    this.logger.log('Monthly report triggered (async)');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');
    if (!chatId) {
      return { status: 'error', message: 'No chat ID configured' };
    }

    // Fire-and-forget: respond immediately, build report in background
    this.buildAndSendMonthlyReport(chatId).catch((err) => {
      this.logger.error(`Monthly report background task failed: ${err.message}`);
    });

    return { status: 'started', message: 'Monthly report generation started. Will be sent to Telegram when ready.' };
  }

  @Post('weekly')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger weekly strategy brief', description: 'Generates and sends Monday morning strategy report to Telegram.' })
  @ApiResponse({ status: 200, description: 'Weekly brief generation started' })
  async triggerWeekly() {
    this.logger.log('Weekly brief triggered (async)');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');
    if (!chatId) return { status: 'error', message: 'No chat ID configured' };

    this.buildAndSendWeeklyBrief(chatId).catch((err) => {
      this.logger.error(`Weekly brief failed: ${err.message}`);
    });
    return { status: 'started', message: 'Weekly brief generation started.' };
  }

  private async buildAndSendWeeklyBrief(chatId: string): Promise<void> {
    try {
      await this.helpers.send(chatId, '⏳ <b>Weekly strategy brief generating...</b>');
      const report = await this.commands.buildWeeklyBrief();
      await this.helpers.send(chatId, report);
    } catch (error: any) {
      this.logger.error(`Weekly brief failed: ${error.message}`);
      await this.helpers.send(chatId, `❌ Weekly brief failed: ${error.message}`).catch(() => {});
    }
  }

  @Post('automation-check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Run autopause and alerts check', description: 'Runs autopause rules and proactive alerts. Called by cron every 30 minutes during business hours.' })
  @ApiResponse({ status: 200, description: 'Automation check completed' })
  async triggerAutomationCheck() {
    this.logger.log('Automation check triggered');
    const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '');
    if (!chatId) return { status: 'error', message: 'No chat ID configured' };

    try {
      const [autopauseActions, alertMessages] = await Promise.all([
        this.commands.runAutopauseCheck(),
        this.commands.runAlertCheck(),
      ]);

      const allMessages = [...autopauseActions, ...alertMessages];
      if (allMessages.length > 0) {
        const msg = `🤖 <b>AUTOMATION ALERT</b>\n\n${allMessages.join('\n\n')}`;
        await this.helpers.send(chatId, msg);
      }

      return { status: 'ok', autopause_actions: autopauseActions.length, alerts: alertMessages.length };
    } catch (error: any) {
      this.logger.error(`Automation check failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  private async buildAndSendMonthlyReport(chatId: string): Promise<void> {
    try {
      await this.helpers.send(chatId, '⏳ <b>Monthly report generating...</b> This may take a minute.');
      const report = await this.buildMonthlyReport();
      await this.helpers.send(chatId, report);
      this.logger.log('Monthly report sent successfully');
    } catch (error: any) {
      this.logger.error(`Monthly report failed: ${error.message}`);
      await this.helpers.send(chatId, `❌ Monthly report failed: ${error.message}`).catch(() => {});
    }
  }

  private async buildMonthlyReport(): Promise<string> {
    const range = this.helpers.parseRange('month');
    const calls = await this.td.fetchAllCallsForRange(range.from, range.to, 100);

    const totalRev = calls.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
    const totalPay = calls.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
    const totalCalls = calls.length;
    const converted = calls.filter((c: any) => c.buyer_converted === 'Converted').length;

    // Revenue by offer (for invoicing)
    const byOffer = this.helpers.groupBy(calls, 'offer');
    let invoiceLines = '';
    for (const [name, oc] of Object.entries(byOffer).sort((a, b) => {
      const aRev = (a[1] as any[]).reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const bRev = (b[1] as any[]).reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      return bRev - aRev;
    })) {
      const arr = oc as any[];
      const oRev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const oPay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
      const oConv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
      invoiceLines += `  📋 <b>${this.helpers.esc(name)}</b>\n`;
      invoiceLines += `     ${arr.length} calls | ${oConv} conv | Rev: $${oRev.toFixed(2)} | Pay: $${oPay.toFixed(2)} | Profit: $${(oRev - oPay).toFixed(2)}\n\n`;
    }

    // Vendor payouts (for paying people)
    const byVendor = this.helpers.groupBy(calls.filter((c: any) => (Number(c.payout) || 0) > 0), 'traffic_source');
    let vendorPayLines = '';
    const vendorPay = Object.entries(byVendor)
      .map(([name, vc]) => ({
        name,
        pay: (vc as any[]).reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0),
        calls: (vc as any[]).length,
        conv: (vc as any[]).filter((c: any) => c.buyer_converted === 'Converted').length,
      }))
      .sort((a, b) => b.pay - a.pay);

    for (const v of vendorPay) {
      vendorPayLines += `  👤 ${this.helpers.esc(v.name)}: <b>$${v.pay.toFixed(2)}</b> (${v.calls} calls, ${v.conv} conv)\n`;
    }

    // Buyer revenue owed (for invoicing clients)
    const byBuyer = this.helpers.groupBy(calls.filter((c: any) => (Number(c.revenue) || 0) > 0), 'buyer');
    let buyerRevLines = '';
    const buyerRev = Object.entries(byBuyer)
      .map(([name, bc]) => ({
        name,
        rev: (bc as any[]).reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0),
        calls: (bc as any[]).length,
        conv: (bc as any[]).filter((c: any) => c.buyer_converted === 'Converted').length,
      }))
      .sort((a, b) => b.rev - a.rev);

    for (const b of buyerRev) {
      buyerRevLines += `  🏢 ${this.helpers.esc(b.name)}: <b>$${b.rev.toFixed(2)}</b> (${b.calls} calls, ${b.conv} conv)\n`;
    }

    return `📊 <b>MONTHLY REPORT</b>\n` +
      `📅 ${range.from} → ${range.to}\n\n` +
      `<b>💰 Summary</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📞 Total Calls: <b>${totalCalls}</b> | ✅ Converted: <b>${converted}</b>\n` +
      `💵 Revenue: <b>$${totalRev.toFixed(2)}</b>\n` +
      `💸 Payouts: <b>$${totalPay.toFixed(2)}</b>\n` +
      `📈 Profit: <b>$${(totalRev - totalPay).toFixed(2)}</b>\n\n` +
      `<b>📋 Revenue by Campaign (Invoice)</b>\n${invoiceLines}` +
      `<b>👤 Vendor Payouts Owed</b>\n${vendorPayLines}\n` +
      `<b>🏢 Buyer Revenue (Invoice To)</b>\n${buyerRevLines}`;
  }
}
