import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackDriveService } from '../trackdrive/trackdrive.service';
import { TelegramService } from '../telegram/telegram.service';
import { ConfigService } from '@nestjs/config';

export interface OfferStats {
  offerName: string;
  totalCalls: number;
  convertedCalls: number;
  noBuyerCalls: number;
  revenue: number;
  payout: number;
  avgDurationSec: number;
  conversionRate: number;
}

export interface VendorDailyStats {
  vendorName: string;
  vendorEmail: string;
  tdSourceId: string;
  date: string; // YYYY-MM-DD
  totalCalls: number;
  convertedCalls: number;
  noBuyerCalls: number;
  totalRevenue: number;
  totalPayout: number;
  avgDurationSec: number;
  conversionRate: number;
  offers: OfferStats[];
}

@Injectable()
export class VendorStatsService {
  private readonly logger = new Logger(VendorStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly td: TrackDriveService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Fetch yesterday's calls for a traffic source, paginating through all pages.
   */
  private async fetchCallsForSource(
    tdSourceId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<any[]> {
    const allCalls: any[] = [];
    let cursor: string | null = null;
    let page = 0;
    const maxPages = 30;
    const columns = 'id,offer,offer_id,revenue,payout,trackdrive_cost,total_duration,answered_duration,status,disposition_name,buyer_converted,created_at';

    do {
      page++;
      const params: Record<string, any> = {
        per_page: 50,
        sort_by: 'created_at',
        sort_order: 'asc',
        created_at_from: dateFrom,
        created_at_to: dateTo,
        traffic_source_id: tdSourceId,
        columns,
      };
      if (cursor) params.cursor = cursor;

      const response = await this.td.listCalls(params);
      const calls = response?.calls || [];
      allCalls.push(...calls);

      const metadata = response?.metadata || {};
      cursor = metadata.next_cursor ? String(metadata.next_cursor) : null;

      if (cursor && page < maxPages) {
        await new Promise((r) => setTimeout(r, 300));
      }
    } while (cursor && page < maxPages);

    return allCalls;
  }

  /**
   * Compute per-offer stats from a list of calls.
   */
  private computeOfferStats(calls: any[]): OfferStats[] {
    const byOffer: Record<string, any[]> = {};
    for (const call of calls) {
      const offerName = call.offer || 'Unknown';
      if (!byOffer[offerName]) byOffer[offerName] = [];
      byOffer[offerName].push(call);
    }

    const stats: OfferStats[] = [];
    for (const [offerName, offerCalls] of Object.entries(byOffer)) {
      const totalCalls = offerCalls.length;
      const convertedCalls = offerCalls.filter(
        (c) => c.buyer_converted === 'Converted' || c.buyer_converted === true,
      ).length;
      const noBuyerCalls = offerCalls.filter(
        (c) => c.status === 'no-buyer' || c.disposition_name === 'No Buyer',
      ).length;
      const revenue = offerCalls.reduce((s, c) => s + (parseFloat(c.revenue) || 0), 0);
      const payout = offerCalls.reduce((s, c) => s + (parseFloat(c.payout) || 0), 0);
      const durations = offerCalls
        .filter((c) => (c.total_duration || 0) > 0)
        .map((c) => Number(c.total_duration));
      const avgDurationSec = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      stats.push({
        offerName,
        totalCalls,
        convertedCalls,
        noBuyerCalls,
        revenue,
        payout,
        avgDurationSec,
        conversionRate: totalCalls > 0 ? (convertedCalls / totalCalls) * 100 : 0,
      });
    }

    // Sort by revenue descending
    stats.sort((a, b) => b.revenue - a.revenue);
    return stats;
  }

  /**
   * Get stats for a single vendor for a given date range.
   */
  async getVendorStats(
    vendor: { company_name: string; email: string; td_source_id: string },
    dateFrom: string,
    dateTo: string,
    dateLabel: string,
  ): Promise<VendorDailyStats | null> {
    const calls = await this.fetchCallsForSource(vendor.td_source_id, dateFrom, dateTo);
    if (calls.length === 0) return null;

    const offers = this.computeOfferStats(calls);
    const totalCalls = calls.length;
    const convertedCalls = calls.filter(
      (c) => c.buyer_converted === 'Converted' || c.buyer_converted === true,
    ).length;
    const noBuyerCalls = calls.filter(
      (c) => c.status === 'no-buyer' || c.disposition_name === 'No Buyer',
    ).length;
    const totalRevenue = calls.reduce((s, c) => s + (parseFloat(c.revenue) || 0), 0);
    const totalPayout = calls.reduce((s, c) => s + (parseFloat(c.payout) || 0), 0);
    const durations = calls
      .filter((c) => (c.total_duration || 0) > 0)
      .map((c) => Number(c.total_duration));
    const avgDurationSec = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      vendorName: vendor.company_name,
      vendorEmail: vendor.email,
      tdSourceId: vendor.td_source_id,
      date: dateLabel,
      totalCalls,
      convertedCalls,
      noBuyerCalls,
      totalRevenue,
      totalPayout,
      avgDurationSec,
      conversionRate: totalCalls > 0 ? (convertedCalls / totalCalls) * 100 : 0,
      offers,
    };
  }

  /**
   * Generate the HTML email for a vendor's daily stats.
   */
  generateEmailHtml(stats: VendorDailyStats, tips: string[] = []): string {
    const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
    const fmtDuration = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return `${m}m ${s}s`;
    };
    const fmtPct = (n: number) => `${n.toFixed(1)}%`;

    let offerRows = '';
    for (const o of stats.offers) {
      offerRows += `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #2d3748;">${o.offerName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #2d3748; text-align: center;">${o.totalCalls}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #2d3748; text-align: center;">${o.convertedCalls}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #2d3748; text-align: center;">${fmtPct(o.conversionRate)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #2d3748; text-align: right; font-weight: 600;">${fmtMoney(o.payout)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #2d3748; text-align: center;">${fmtDuration(o.avgDurationSec)}</td>
        </tr>`;
    }

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; padding: 20px;">
    <tr><td>

      <!-- Header -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); border-radius: 12px 12px 0 0;">
        <tr><td style="padding: 28px 24px;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Daily Performance Report</h1>
          <p style="margin: 6px 0 0; color: #bee3f8; font-size: 14px;">${stats.date} | ${stats.vendorName}</p>
        </td></tr>
      </table>

      <!-- Summary Cards -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
        <tr><td style="padding: 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="33%" style="text-align: center; padding: 12px;">
                <div style="font-size: 28px; font-weight: 700; color: #2b6cb0;">${stats.totalCalls}</div>
                <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Total Calls</div>
              </td>
              <td width="33%" style="text-align: center; padding: 12px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                <div style="font-size: 28px; font-weight: 700; color: #38a169;">${stats.convertedCalls}</div>
                <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Converted</div>
              </td>
              <td width="33%" style="text-align: center; padding: 12px;">
                <div style="font-size: 28px; font-weight: 700; color: #38a169;">${fmtMoney(stats.totalPayout)}</div>
                <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Your Payout</div>
              </td>
            </tr>
          </table>

          <!-- Secondary stats -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background: #f7fafc; border-radius: 8px;">
            <tr>
              <td width="33%" style="text-align: center; padding: 10px;">
                <div style="font-size: 16px; font-weight: 600; color: #4a5568;">${fmtPct(stats.conversionRate)}</div>
                <div style="font-size: 11px; color: #a0aec0;">Conv. Rate</div>
              </td>
              <td width="33%" style="text-align: center; padding: 10px;">
                <div style="font-size: 16px; font-weight: 600; color: #4a5568;">${fmtDuration(stats.avgDurationSec)}</div>
                <div style="font-size: 11px; color: #a0aec0;">Avg Duration</div>
              </td>
              <td width="33%" style="text-align: center; padding: 10px;">
                <div style="font-size: 16px; font-weight: 600; color: ${stats.noBuyerCalls > 0 ? '#e53e3e' : '#38a169'};">${stats.noBuyerCalls}</div>
                <div style="font-size: 11px; color: #a0aec0;">No-Buyer</div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <!-- Offer Breakdown -->
      ${stats.offers.length > 1 ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
        <tr><td style="padding: 0 24px 24px;">
          <h2 style="margin: 0 0 12px; font-size: 16px; color: #2d3748; font-weight: 600;">Per-Offer Breakdown</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #edf2f7;">
                <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase;">Offer</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase;">Calls</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase;">Conv</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase;">Rate</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase;">Payout</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #4a5568; font-weight: 600; text-transform: uppercase;">Avg Dur</th>
              </tr>
            </thead>
            <tbody>${offerRows}</tbody>
          </table>
        </td></tr>
      </table>` : ''}

      <!-- AI Tips Section -->
      ${tips.length > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
        <tr><td style="padding: 0 24px 24px;">
          <div style="background: linear-gradient(135deg, #f0fff4 0%, #ebf8ff 100%); border-radius: 8px; padding: 20px; border-left: 4px solid #38a169;">
            <h2 style="margin: 0 0 14px; font-size: 16px; color: #22543d; font-weight: 700;">Performance Tips</h2>
            ${tips.map((tip, i) => `
            <div style="margin: ${i > 0 ? '12px' : '0'} 0 0; padding: ${i > 0 ? '12px 0 0' : '0'}; ${i > 0 ? 'border-top: 1px solid #c6f6d5;' : ''}">
              <p style="margin: 0; font-size: 14px; color: #2d3748; line-height: 1.5;">${tip}</p>
            </div>`).join('')}
          </div>
        </td></tr>
      </table>` : ''}

      <!-- Footer -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #edf2f7; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
        <tr><td style="padding: 20px 24px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #718096;">This is an automated daily report from The Broken Wood Inc.</p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #a0aec0;">Questions? Reply to this email or contact your account manager.</p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generate personalized AI tips for a vendor based on their daily stats.
   */
  private async generateVendorTips(stats: VendorDailyStats): Promise<string[]> {
    try {
      const apiKey = process.env.ABACUSAI_API_KEY;
      if (!apiKey) {
        this.logger.warn('No ABACUSAI_API_KEY — skipping AI tips');
        return [];
      }

      const offerBreakdown = stats.offers.map(o =>
        `${o.offerName}: ${o.totalCalls} calls, ${o.convertedCalls} converted (${o.conversionRate.toFixed(1)}%), $${o.payout.toFixed(2)} payout, ${o.noBuyerCalls} no-buyer, avg ${Math.round(o.avgDurationSec)}s duration`
      ).join('\n');

      const prompt = `You are a performance marketing analyst at The Broken Wood Inc, a call campaign brokerage. A vendor named "${stats.vendorName}" just finished their day. Analyze their stats and give them 2-3 short, specific, actionable tips to improve tomorrow.

THEIR STATS FOR ${stats.date}:
- Total Calls: ${stats.totalCalls}
- Converted: ${stats.convertedCalls} (${stats.conversionRate.toFixed(1)}%)
- No-Buyer Calls: ${stats.noBuyerCalls} (${stats.totalCalls > 0 ? ((stats.noBuyerCalls / stats.totalCalls) * 100).toFixed(1) : 0}%)
- Total Payout: $${stats.totalPayout.toFixed(2)}
- Avg Duration: ${Math.round(stats.avgDurationSec)}s

PER-OFFER BREAKDOWN:
${offerBreakdown}

CONTEXT:
- This is an inbound/RTB call business. Vendors send call traffic, buyers bid in real-time.
- Higher conversion rates = buyers bid more = more revenue for vendor.
- No-buyer calls mean the call came in but no buyer was available or willing to bid — this costs the vendor effort with no payout.
- Longer call duration on converted calls generally means higher payouts (duration-based conversions).
- Campaigns with 0% conversion are burning the vendor's ad spend with no return.

RULES:
- Be direct and professional, no fluff or emojis
- Reference their specific numbers (e.g. "Your Pest Control conversion rate of 3.2% is below the 8-10% target")
- If they have campaigns with 0 conversions, call it out specifically
- If no-buyer rate is high (>20%), mention it — it means calls are coming in at times/geos where buyers aren't active
- If conversion is strong (>15%), acknowledge it and suggest scaling
- Keep each tip to 1-2 sentences max
- Do not mention BSBW by name in the tips

Respond in JSON format:
{
  "tips": ["tip 1 text", "tip 2 text", "tip 3 text"]
}
Respond with raw JSON only.`;

      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          stream: false,
        }),
      });

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn(`No AI response for ${stats.vendorName}`);
        return [];
      }

      const parsed = JSON.parse(content);
      const tips = parsed?.tips;
      if (!Array.isArray(tips) || tips.length === 0) return [];

      this.logger.log(`Generated ${tips.length} AI tips for ${stats.vendorName}`);
      return tips.slice(0, 3); // max 3 tips
    } catch (error: any) {
      this.logger.error(`AI tips error for ${stats.vendorName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Send daily stats email to a single vendor.
   */
  async sendDailyStatsEmail(stats: VendorDailyStats): Promise<boolean> {
    try {
      const hostname = (() => {
        try {
          return new URL(process.env.APP_ORIGIN || 'https://bsbw-qa-agent.abacusai.app').hostname;
        } catch {
          return 'bsbw-qa-agent.abacusai.app';
        }
      })();

      // Generate personalized AI tips
      const tips = await this.generateVendorTips(stats);

      const subject = `Daily Report: ${stats.totalCalls} calls, ${stats.convertedCalls} converted, $${stats.totalPayout.toFixed(2)} payout - ${stats.date}`;
      const html = this.generateEmailHtml(stats, tips);

      const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_VENDOR_DAILY_STATS_REPORT,
          subject,
          body: html,
          is_html: true,
          recipient_email: stats.vendorEmail,
          sender_email: `noreply@${hostname}`,
          sender_alias: 'The Broken Wood Inc',
          reply_to: 'uj@grovlabs.com',
        }),
      });

      const result = (await response.json()) as any;
      if (!result.success && !result.notification_disabled) {
        this.logger.error(`Email failed for ${stats.vendorName}: ${result.message}`);
        return false;
      }
      this.logger.log(`Daily stats email sent to ${stats.vendorName} (${stats.vendorEmail})`);

      // Send a copy to Sammy
      try {
        await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_VENDOR_DAILY_STATS_REPORT,
            subject: `[Copy] ${subject}`,
            body: html,
            is_html: true,
            recipient_email: 'uj@grovlabs.com',
            sender_email: `noreply@${hostname}`,
            sender_alias: 'The Broken Wood Inc',
          }),
        });
      } catch (ccErr: any) {
        this.logger.warn(`Failed to CC Sammy on ${stats.vendorName} email: ${ccErr.message}`);
      }

      return true;
    } catch (error: any) {
      this.logger.error(`Email error for ${stats.vendorName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Run the daily stats job: fetch all active vendors, pull their same-day stats, send emails.
   * Returns a summary of what was sent.
   */
  async runDailyStatsJob(options?: { dryRun?: boolean; singleVendorId?: string }): Promise<{
    vendorsProcessed: number;
    emailsSent: number;
    vendorsSkipped: number;
    errors: string[];
    results: { vendor: string; email: string; calls: number; payout: number; sent: boolean }[];
  }> {
    const dryRun = options?.dryRun ?? false;
    const singleVendorId = options?.singleVendorId;

    // Calculate today's date range in PST (AZ is always UTC-7, no DST)
    const now = new Date();
    const pstOffset = -7;
    const pstNow = new Date(now.getTime() + pstOffset * 60 * 60 * 1000);
    const today = new Date(pstNow);

    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateFrom = `${dateStr}T00:00:00-07:00`;
    const dateTo = `${dateStr}T23:59:59-07:00`;
    const dateLabel = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    this.logger.log(`Running daily vendor stats for ${dateLabel} (dry_run=${dryRun})`);

    // Get active vendors with TrackDrive source IDs
    const whereClause: any = {
      status: 'active',
      td_source_id: { not: null },
    };
    if (singleVendorId) {
      whereClause.id = singleVendorId;
    }

    const vendors = await this.prisma.vendor_profile.findMany({
      where: whereClause,
      select: {
        id: true,
        company_name: true,
        email: true,
        td_source_id: true,
      },
    });

    this.logger.log(`Found ${vendors.length} active vendors with TD source IDs`);

    const results: { vendor: string; email: string; calls: number; payout: number; sent: boolean }[] = [];
    const errors: string[] = [];
    let emailsSent = 0;
    let vendorsSkipped = 0;

    for (const vendor of vendors) {
      try {
        const stats = await this.getVendorStats(
          {
            company_name: vendor.company_name,
            email: vendor.email,
            td_source_id: vendor.td_source_id!,
          },
          dateFrom,
          dateTo,
          dateLabel,
        );

        if (!stats) {
          vendorsSkipped++;
          this.logger.log(`Skipping ${vendor.company_name}: no calls today`);
          results.push({ vendor: vendor.company_name, email: vendor.email, calls: 0, payout: 0, sent: false });
          continue;
        }

        if (dryRun) {
          results.push({ vendor: vendor.company_name, email: vendor.email, calls: stats.totalCalls, payout: stats.totalPayout, sent: false });
          continue;
        }

        const sent = await this.sendDailyStatsEmail(stats);
        if (sent) emailsSent++;
        results.push({ vendor: vendor.company_name, email: vendor.email, calls: stats.totalCalls, payout: stats.totalPayout, sent });

        // Rate limit: small delay between emails
        await new Promise((r) => setTimeout(r, 500));
      } catch (error: any) {
        const msg = `Error processing ${vendor.company_name}: ${error.message}`;
        this.logger.error(msg);
        errors.push(msg);
        results.push({ vendor: vendor.company_name, email: vendor.email, calls: 0, payout: 0, sent: false });
      }
    }

    this.logger.log(`Daily stats complete: ${emailsSent} sent, ${vendorsSkipped} skipped, ${errors.length} errors`);

    // Send Telegram summary (skip for dry runs)
    if (!dryRun) {
      try {
        const sentVendors = results.filter(r => r.sent);
        const totalPayout = sentVendors.reduce((s, r) => s + r.payout, 0);
        const totalCalls = sentVendors.reduce((s, r) => s + r.calls, 0);

        let msg = `<b>Vendor Daily Stats Emails Sent</b>\n${'='.repeat(35)}\n`;
        msg += `${dateLabel}\n\n`;

        if (sentVendors.length > 0) {
          for (const v of sentVendors) {
            msg += `${v.vendor}: ${v.calls} calls, $${v.payout.toFixed(2)}\n`;
          }
          msg += `\nTotal: ${totalCalls} calls, $${totalPayout.toFixed(2)} across ${sentVendors.length} vendors`;
        } else {
          msg += 'No vendors had calls today -- no emails sent.';
        }

        if (errors.length > 0) {
          msg += `\n\nErrors (${errors.length}):\n`;
          for (const e of errors.slice(0, 5)) {
            msg += `- ${e}\n`;
          }
        }

        await this.telegram.sendMessage(msg);
      } catch (tgErr: any) {
        this.logger.warn(`Failed to send Telegram summary: ${tgErr.message}`);
      }
    }

    return {
      vendorsProcessed: vendors.length,
      emailsSent,
      vendorsSkipped,
      errors,
      results,
    };
  }

  /**
   * Preview: get stats and HTML for a single vendor (for approval/testing).
   */
  async previewVendorEmail(vendorId: string): Promise<{ stats: VendorDailyStats; html: string } | null> {
    const vendor = await this.prisma.vendor_profile.findUnique({
      where: { id: vendorId },
      select: { company_name: true, email: true, td_source_id: true },
    });

    if (!vendor || !vendor.td_source_id) return null;

    // Use today's date range in PST (AZ is always UTC-7)
    const now = new Date();
    const pstOffset = -7;
    const pstNow = new Date(now.getTime() + pstOffset * 60 * 60 * 1000);
    const today = new Date(pstNow);
    const dateStr = today.toISOString().split('T')[0];
    const dateFrom = `${dateStr}T00:00:00-07:00`;
    const dateTo = `${dateStr}T23:59:59-07:00`;
    const dateLabel = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const stats = await this.getVendorStats(
      { company_name: vendor.company_name, email: vendor.email, td_source_id: vendor.td_source_id },
      dateFrom,
      dateTo,
      dateLabel,
    );

    if (!stats) return null;
    const tips = await this.generateVendorTips(stats);
    return { stats, html: this.generateEmailHtml(stats, tips) };
  }
}
