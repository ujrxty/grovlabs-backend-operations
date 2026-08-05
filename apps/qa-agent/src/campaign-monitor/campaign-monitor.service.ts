import { Injectable, Logger } from '@nestjs/common';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

export interface OfferSnapshot {
  offerId: number;
  offerName: string;
  totalCalls: number;
  noBuyerCalls: number;
  convertedCalls: number;
  totalRevenue: number;
  totalPayout: number;
  totalCost: number;
  avgDuration: number;
  noBuyerRate: number;
  conversionRate: number;
  margin: number;
}

export interface MonitorAlert {
  type: 'no_buyer_spike' | 'dead_campaign' | 'revenue_drop' | 'conversion_drop' | 'high_cost_no_revenue';
  severity: 'warning' | 'critical';
  offerName: string;
  message: string;
  data: Record<string, any>;
}

@Injectable()
export class CampaignMonitorService {
  private readonly logger = new Logger(CampaignMonitorService.name);

  constructor(
    private readonly td: TrackDriveService,
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Main monitoring entry point - called by cron every 15 minutes
   */
  async runHealthCheck(apiKey: string): Promise<{ alerts: MonitorAlert[]; summary: any }> {
    const expectedKey = this.config.get<string>('MONITOR_API_KEY', '');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new Error('Invalid API key');
    }

    this.logger.log('Starting campaign health check...');

    const now = new Date();
    const pstHour = this.getPSTHour(now);
    const isBusinessHours = pstHour >= 9 && pstHour < 17;
    const isDaytime = pstHour >= 7 && pstHour < 20; // wider window for basic monitoring

    // Skip entirely outside daytime hours
    if (!isDaytime) {
      this.logger.log(`Outside monitoring hours (PST hour: ${pstHour}). Skipping.`);
      return { alerts: [], summary: { skipped: true, reason: 'outside_hours', pstHour } };
    }

    try {
      // Fetch current period data (last 2 hours for recent trend)
      const recentCalls = await this.fetchCallsByTimeLabel('Last 4 Hours');
      // Fetch today's full data for comparison
      const todayCalls = await this.fetchCallsByTimeLabel('Today');
      // Fetch yesterday for baseline comparison
      const yesterdayCalls = await this.fetchCallsByTimeLabel('Yesterday');

      // Build per-offer snapshots
      const recentByOffer = this.buildOfferSnapshots(recentCalls);
      const todayByOffer = this.buildOfferSnapshots(todayCalls);
      const yesterdayByOffer = this.buildOfferSnapshots(yesterdayCalls);

      // Run all detectors
      const alerts: MonitorAlert[] = [];

      // 1. No-buyer spike detection (always active during daytime)
      alerts.push(...this.detectNoBuyerSpikes(recentByOffer, todayByOffer));

      // 2. Dead campaign detection (business hours only)
      if (isBusinessHours) {
        alerts.push(...this.detectDeadCampaigns(recentByOffer, yesterdayByOffer));
      }

      // 3. Revenue drop detection (business hours only)
      if (isBusinessHours) {
        alerts.push(...this.detectRevenueDrops(todayByOffer, yesterdayByOffer, pstHour));
      }

      // 4. High cost / no revenue detection
      alerts.push(...this.detectHighCostNoRevenue(recentByOffer));

      // De-duplicate: suppress any alert that was already sent within the
      // suppression window (default 12h) for the same type+offer signature.
      // This prevents the same critical alert from repeating every 15 minutes.
      const alertsToSend = await this.filterDuplicateAlerts(alerts);
      const suppressedCount = alerts.length - alertsToSend.length;
      if (suppressedCount > 0) {
        this.logger.log(
          `Suppressed ${suppressedCount} duplicate alert(s) still inside the ${this.DEDUPE_WINDOW_HOURS}h window`,
        );
      }

      // Send alerts via Telegram
      if (alertsToSend.length > 0) {
        await this.sendAlerts(alertsToSend);
        await this.recordAlertsSent(alertsToSend);
      }

      const summary = {
        timestamp: now.toISOString(),
        pstHour,
        isBusinessHours,
        offersMonitored: Object.keys(recentByOffer).length,
        alertsGenerated: alerts.length,
        alertsSent: alertsToSend.length,
        alertsSuppressed: suppressedCount,
        recentCallCount: recentCalls.length,
        todayCallCount: todayCalls.length,
      };

      this.logger.log(`Health check complete: ${alerts.length} alerts generated, ${alertsToSend.length} sent, ${suppressedCount} suppressed (${Object.keys(recentByOffer).length} offers)`);
      return { alerts: alertsToSend, summary };

    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      // Send error alert (also de-duped on the same 12h window so a persistent
      // failure doesn't spam the same error message every 15 minutes).
      try {
        if (await this.shouldSendSignature('monitor_error')) {
          await this.telegram.sendMessage(
            `CAMPAIGN MONITOR ERROR\n\nHealth check failed: ${error.message}\n\nCheck logs for details.`
          );
          await this.markSignatureSent('monitor_error');
        }
      } catch (_e) { /* ignore telegram errors */ }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Alert de-duplication (12h suppression window per alert signature)
  // ---------------------------------------------------------------------------

  private readonly DEDUPE_KEY = 'campaign_alert_dedupe';
  private readonly DEDUPE_WINDOW_HOURS = 12;
  private get DEDUPE_WINDOW_MS(): number {
    return this.DEDUPE_WINDOW_HOURS * 60 * 60 * 1000;
  }

  /** A stable signature for an alert so repeats of the same issue collapse. */
  private alertSignature(a: MonitorAlert): string {
    return `${a.type}::${a.offerName}`;
  }

  /** Load the persisted map of signature -> last-sent ISO timestamp. */
  private async loadDedupeMap(): Promise<Record<string, string>> {
    try {
      const row = await this.prisma.bot_setting.findUnique({ where: { key: this.DEDUPE_KEY } });
      if (!row?.value) return {};
      const parsed = JSON.parse(row.value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err: any) {
      this.logger.warn(`Could not load alert de-dupe map: ${err.message}`);
      return {};
    }
  }

  /** Persist the de-dupe map, pruning entries older than 2x the window. */
  private async saveDedupeMap(map: Record<string, string>): Promise<void> {
    const cutoff = Date.now() - this.DEDUPE_WINDOW_MS * 2;
    const pruned: Record<string, string> = {};
    for (const [sig, iso] of Object.entries(map)) {
      const t = Date.parse(iso);
      if (!isNaN(t) && t >= cutoff) pruned[sig] = iso;
    }
    try {
      await this.prisma.bot_setting.upsert({
        where: { key: this.DEDUPE_KEY },
        update: { value: JSON.stringify(pruned) },
        create: { key: this.DEDUPE_KEY, value: JSON.stringify(pruned) },
      });
    } catch (err: any) {
      this.logger.warn(`Could not save alert de-dupe map: ${err.message}`);
    }
  }

  /** Keep only alerts whose signature has NOT been sent inside the window. */
  private async filterDuplicateAlerts(alerts: MonitorAlert[]): Promise<MonitorAlert[]> {
    if (alerts.length === 0) return [];
    const map = await this.loadDedupeMap();
    const now = Date.now();
    const fresh: MonitorAlert[] = [];
    for (const a of alerts) {
      const sig = this.alertSignature(a);
      const lastIso = map[sig];
      const last = lastIso ? Date.parse(lastIso) : 0;
      if (!last || now - last >= this.DEDUPE_WINDOW_MS) {
        fresh.push(a);
      } else {
        this.logger.log(`Suppressing duplicate alert "${sig}" (last sent ${lastIso})`);
      }
    }
    return fresh;
  }

  /** Record the timestamp for alerts we actually sent. */
  private async recordAlertsSent(alerts: MonitorAlert[]): Promise<void> {
    const map = await this.loadDedupeMap();
    const nowIso = new Date().toISOString();
    for (const a of alerts) {
      map[this.alertSignature(a)] = nowIso;
    }
    await this.saveDedupeMap(map);
  }

  /** Generic single-signature check (used for the monitor error message). */
  private async shouldSendSignature(sig: string): Promise<boolean> {
    const map = await this.loadDedupeMap();
    const last = map[sig] ? Date.parse(map[sig]) : 0;
    return !last || Date.now() - last >= this.DEDUPE_WINDOW_MS;
  }

  private async markSignatureSent(sig: string): Promise<void> {
    const map = await this.loadDedupeMap();
    map[sig] = new Date().toISOString();
    await this.saveDedupeMap(map);
  }

  /**
   * Fetch calls from TrackDrive with pagination
   */
  /** Retry a TrackDrive fetch a few times to tolerate transient network/API blips. */
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 1500): Promise<T> {
    let lastErr: any;
    for (let i = 1; i <= attempts; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        this.logger.warn(`TrackDrive fetch attempt ${i}/${attempts} failed: ${err.message}`);
        if (i < attempts) {
          await new Promise((r) => setTimeout(r, baseDelayMs * i));
        }
      }
    }
    throw lastErr;
  }

  private async fetchCallsByTimeLabel(label: string): Promise<any[]> {
    const allCalls: any[] = [];
    let page = 1;
    const maxPages = 20; // Safety limit
    const columns = 'id,offer,offer_id,buyer,buyer_id,traffic_source,traffic_source_id,revenue,payout,trackdrive_cost,total_duration,answered_duration,status,disposition_name,hangup_cause,caller_city,created_at,buyer_converted';

    while (page <= maxPages) {
      const currentPage = page;
      const data = await this.withRetry(() =>
        this.td.listCalls({
          created_at_label: label,
          per_page: 100,
          page: currentPage,
          columns,
        }),
      );

      const calls = data?.calls || [];
      allCalls.push(...calls);

      const totalPages = data?.metadata?.total_pages || 1;
      if (page >= totalPages) break;
      page++;
    }

    return allCalls;
  }

  /**
   * Group calls by offer and compute metrics
   */
  private buildOfferSnapshots(calls: any[]): Record<string, OfferSnapshot> {
    const byOffer: Record<string, any[]> = {};

    for (const call of calls) {
      const offerName = call.offer || 'Unknown';
      if (!byOffer[offerName]) byOffer[offerName] = [];
      byOffer[offerName].push(call);
    }

    const snapshots: Record<string, OfferSnapshot> = {};

    for (const [offerName, offerCalls] of Object.entries(byOffer)) {
      const totalCalls = offerCalls.length;
      const noBuyerCalls = offerCalls.filter(c => c.status === 'no-buyer' || c.disposition_name === 'No Buyer').length;
      const convertedCalls = offerCalls.filter(c => c.buyer_converted === 'Converted' || c.buyer_converted === true).length;
      const totalRevenue = offerCalls.reduce((sum, c) => sum + (parseFloat(c.revenue) || 0), 0);
      const totalPayout = offerCalls.reduce((sum, c) => sum + (parseFloat(c.payout) || 0), 0);
      const totalCost = offerCalls.reduce((sum, c) => sum + (parseFloat(c.trackdrive_cost) || 0), 0);
      const durations = offerCalls.filter(c => (c.total_duration || 0) > 0).map(c => c.total_duration);
      const avgDuration = durations.length > 0 ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0;

      snapshots[offerName] = {
        offerId: offerCalls[0]?.offer_id || 0,
        offerName,
        totalCalls,
        noBuyerCalls,
        convertedCalls,
        totalRevenue,
        totalPayout,
        totalCost,
        avgDuration,
        noBuyerRate: totalCalls > 0 ? (noBuyerCalls / totalCalls) * 100 : 0,
        conversionRate: totalCalls > 0 ? (convertedCalls / totalCalls) * 100 : 0,
        margin: totalRevenue - totalPayout - totalCost,
      };
    }

    return snapshots;
  }

  /**
   * Detect offers with abnormally high no-buyer rates
   */
  private detectNoBuyerSpikes(
    recent: Record<string, OfferSnapshot>,
    today: Record<string, OfferSnapshot>,
  ): MonitorAlert[] {
    const alerts: MonitorAlert[] = [];

    for (const [offerName, snapshot] of Object.entries(recent)) {
      // Need at least 3 calls to make a judgment
      if (snapshot.totalCalls < 3) continue;

      // Critical: >60% no-buyer rate with decent volume
      if (snapshot.noBuyerRate > 60 && snapshot.noBuyerCalls >= 3) {
        const todaySnapshot = today[offerName];
        const todayRate = todaySnapshot ? todaySnapshot.noBuyerRate : 0;

        alerts.push({
          type: 'no_buyer_spike',
          severity: snapshot.noBuyerRate > 80 ? 'critical' : 'warning',
          offerName,
          message: this.formatNoBuyerAlert(snapshot, todaySnapshot),
          data: {
            recentNoBuyerRate: snapshot.noBuyerRate,
            todayNoBuyerRate: todayRate,
            recentCalls: snapshot.totalCalls,
            recentNoBuyer: snapshot.noBuyerCalls,
            lostRevenuePotential: snapshot.noBuyerCalls * (todaySnapshot?.totalRevenue / Math.max(todaySnapshot?.convertedCalls || 1, 1) || 0),
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Detect campaigns that had activity yesterday but none recently
   */
  private detectDeadCampaigns(
    recent: Record<string, OfferSnapshot>,
    yesterday: Record<string, OfferSnapshot>,
  ): MonitorAlert[] {
    const alerts: MonitorAlert[] = [];

    for (const [offerName, yesterdaySnapshot] of Object.entries(yesterday)) {
      // Only alert for offers that had meaningful volume yesterday
      if (yesterdaySnapshot.totalCalls < 5) continue;

      const recentSnapshot = recent[offerName];
      // No calls at all in last 4 hours during business hours
      if (!recentSnapshot || recentSnapshot.totalCalls === 0) {
        alerts.push({
          type: 'dead_campaign',
          severity: 'critical',
          offerName,
          message: `DEAD CAMPAIGN: ${offerName}\n\nZero calls in the last 4 hours during business hours.\nYesterday this offer had ${yesterdaySnapshot.totalCalls} calls with $${yesterdaySnapshot.totalRevenue.toFixed(2)} revenue.\n\nPossible causes:\n- DID not working\n- Buyer offline/paused\n- Routing config issue\n- Traffic source stopped sending`,
          data: {
            yesterdayCalls: yesterdaySnapshot.totalCalls,
            yesterdayRevenue: yesterdaySnapshot.totalRevenue,
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Detect significant revenue drops compared to yesterday's pace
   * Only during business hours (9am-5pm PST)
   */
  private detectRevenueDrops(
    today: Record<string, OfferSnapshot>,
    yesterday: Record<string, OfferSnapshot>,
    pstHour: number,
  ): MonitorAlert[] {
    const alerts: MonitorAlert[] = [];

    // Calculate what fraction of the business day has elapsed
    // Business hours: 9am-5pm (8 hours)
    const hoursElapsed = Math.max(pstHour - 9, 0.5);
    const dayFraction = hoursElapsed / 8;

    for (const [offerName, yesterdaySnapshot] of Object.entries(yesterday)) {
      if (yesterdaySnapshot.totalRevenue < 20) continue; // Skip low-rev offers

      const todaySnapshot = today[offerName];
      const todayRevenue = todaySnapshot?.totalRevenue || 0;
      const expectedRevenue = yesterdaySnapshot.totalRevenue * dayFraction;

      // Alert if today's revenue is less than 40% of expected pace
      if (expectedRevenue > 20 && todayRevenue < expectedRevenue * 0.4) {
        alerts.push({
          type: 'revenue_drop',
          severity: todayRevenue < expectedRevenue * 0.2 ? 'critical' : 'warning',
          offerName,
          message: `REVENUE DROP: ${offerName}\n\nToday: $${todayRevenue.toFixed(2)}\nExpected by now: $${expectedRevenue.toFixed(2)} (based on yesterday's $${yesterdaySnapshot.totalRevenue.toFixed(2)})\nPace: ${((todayRevenue / expectedRevenue) * 100).toFixed(0)}% of yesterday\n\nToday: ${todaySnapshot?.totalCalls || 0} calls, ${todaySnapshot?.convertedCalls || 0} converted\nYesterday: ${yesterdaySnapshot.totalCalls} calls, ${yesterdaySnapshot.convertedCalls} converted`,
          data: {
            todayRevenue,
            expectedRevenue,
            yesterdayRevenue: yesterdaySnapshot.totalRevenue,
            pacePercent: (todayRevenue / expectedRevenue) * 100,
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Detect offers spending TrackDrive costs but generating no revenue
   */
  private detectHighCostNoRevenue(recent: Record<string, OfferSnapshot>): MonitorAlert[] {
    const alerts: MonitorAlert[] = [];

    for (const [offerName, snapshot] of Object.entries(recent)) {
      // Spending on TD costs but zero revenue
      if (snapshot.totalCost > 0.50 && snapshot.totalRevenue === 0 && snapshot.totalCalls >= 5) {
        alerts.push({
          type: 'high_cost_no_revenue',
          severity: 'warning',
          offerName,
          message: `COST LEAK: ${offerName}\n\n${snapshot.totalCalls} calls in last 4 hours with $0 revenue.\nTrackDrive cost: $${snapshot.totalCost.toFixed(2)}\nAll calls resulting in no-buyer or zero revenue.\n\nYou're paying TD costs for calls that aren't converting.`,
          data: {
            calls: snapshot.totalCalls,
            cost: snapshot.totalCost,
            noBuyerRate: snapshot.noBuyerRate,
          },
        });
      }
    }

    return alerts;
  }

  /**
   * Format a no-buyer spike alert message
   */
  private formatNoBuyerAlert(recent: OfferSnapshot, today?: OfferSnapshot): string {
    const avgRevPerCall = today && today.convertedCalls > 0
      ? today.totalRevenue / today.convertedCalls
      : 0;
    const estLostRevenue = recent.noBuyerCalls * avgRevPerCall;

    let msg = `NO-BUYER SPIKE: ${recent.offerName}\n\n`;
    msg += `Last 4 hours: ${recent.noBuyerCalls}/${recent.totalCalls} calls had NO BUYER (${recent.noBuyerRate.toFixed(0)}%)\n`;
    if (today) {
      msg += `Today overall: ${today.noBuyerCalls}/${today.totalCalls} no-buyer (${today.noBuyerRate.toFixed(0)}%)\n`;
    }
    if (estLostRevenue > 0) {
      msg += `\nEstimated lost revenue: $${estLostRevenue.toFixed(2)}\n`;
      msg += `(Based on avg $${avgRevPerCall.toFixed(2)}/converted call)\n`;
    }
    msg += `\nPossible causes:\n`;
    msg += `- Buyer bids below your minimum floor\n`;
    msg += `- Buyer geo/schedule filters rejecting calls\n`;
    msg += `- Buyer hit daily/concurrency cap\n`;
    msg += `- Buyer DID/SIP endpoint down`;

    return msg;
  }

  /**
   * Send alerts via Telegram - batched into one message if possible
   */
  private async sendAlerts(alerts: MonitorAlert[]): Promise<void> {
    // Group by severity
    const critical = alerts.filter(a => a.severity === 'critical');
    const warnings = alerts.filter(a => a.severity === 'warning');

    if (critical.length > 0) {
      const header = `CAMPAIGN MONITOR - ${critical.length} CRITICAL ALERT${critical.length > 1 ? 'S' : ''}\n${'='.repeat(40)}\n\n`;
      const body = critical.map(a => a.message).join('\n\n---\n\n');
      await this.sendLongMessage(header + body);
    }

    if (warnings.length > 0) {
      const header = `CAMPAIGN MONITOR - ${warnings.length} WARNING${warnings.length > 1 ? 'S' : ''}\n${'='.repeat(40)}\n\n`;
      const body = warnings.map(a => a.message).join('\n\n---\n\n');
      await this.sendLongMessage(header + body);
    }
  }

  /**
   * Send a long message, splitting if needed (Telegram 4096 char limit)
   */
  private async sendLongMessage(text: string): Promise<void> {
    const MAX_LEN = 4000;
    if (text.length <= MAX_LEN) {
      await this.telegram.sendMessage(text);
      return;
    }

    // Split on double newlines
    const chunks: string[] = [];
    let current = '';
    for (const line of text.split('\n')) {
      if ((current + '\n' + line).length > MAX_LEN) {
        if (current) chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
      await this.telegram.sendMessage(chunk);
    }
  }

  /**
   * Generate an on-demand RTB stats summary
   */
  async getRTBStats(timeLabel: string = 'Today'): Promise<string> {
    const calls = await this.fetchCallsByTimeLabel(timeLabel);
    const byOffer = this.buildOfferSnapshots(calls);

    if (Object.keys(byOffer).length === 0) {
      return `No call data found for ${timeLabel}.`;
    }

    let msg = `RTB CAMPAIGN STATS - ${timeLabel}\n${'='.repeat(35)}\n\n`;

    // Sort by revenue descending
    const sorted = Object.values(byOffer).sort((a, b) => b.totalRevenue - a.totalRevenue);

    let grandTotalRev = 0;
    let grandTotalPay = 0;
    let grandTotalCost = 0;
    let grandTotalCalls = 0;
    let grandNoBuyer = 0;
    let grandConverted = 0;

    for (const s of sorted) {
      grandTotalRev += s.totalRevenue;
      grandTotalPay += s.totalPayout;
      grandTotalCost += s.totalCost;
      grandTotalCalls += s.totalCalls;
      grandNoBuyer += s.noBuyerCalls;
      grandConverted += s.convertedCalls;

      msg += `${s.offerName}\n`;
      msg += `  Calls: ${s.totalCalls} | Converted: ${s.convertedCalls} | No-Buyer: ${s.noBuyerCalls}`;
      if (s.noBuyerRate > 30) msg += ` (${s.noBuyerRate.toFixed(0)}%!)`;
      msg += `\n`;
      msg += `  Revenue: $${s.totalRevenue.toFixed(2)} | Payout: $${s.totalPayout.toFixed(2)} | Margin: $${s.margin.toFixed(2)}\n`;
      if (s.convertedCalls > 0) {
        msg += `  Avg Rev/Call: $${(s.totalRevenue / s.convertedCalls).toFixed(2)} | Avg Duration: ${Math.round(s.avgDuration)}s\n`;
      }
      msg += `\n`;
    }

    const grandMargin = grandTotalRev - grandTotalPay - grandTotalCost;
    msg += `${'='.repeat(35)}\n`;
    msg += `TOTALS\n`;
    msg += `  Calls: ${grandTotalCalls} | Converted: ${grandConverted} | No-Buyer: ${grandNoBuyer}`;
    if (grandTotalCalls > 0) msg += ` (${((grandNoBuyer / grandTotalCalls) * 100).toFixed(0)}%)`;
    msg += `\n`;
    msg += `  Revenue: $${grandTotalRev.toFixed(2)} | Payout: $${grandTotalPay.toFixed(2)}\n`;
    msg += `  TD Cost: $${grandTotalCost.toFixed(2)} | Net Margin: $${grandMargin.toFixed(2)}\n`;
    if (grandConverted > 0) {
      msg += `  Avg Rev/Converted Call: $${(grandTotalRev / grandConverted).toFixed(2)}`;
    }

    return msg;
  }

  /**
   * Get current PST hour (0-23)
   */
  private getPSTHour(date: Date): number {
    const pst = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return pst.getHours();
  }
}
