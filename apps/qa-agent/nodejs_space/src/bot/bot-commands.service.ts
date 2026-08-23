import { Injectable, Logger } from '@nestjs/common';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BotHelpersService } from './bot-helpers.service.js';
import { TranscriptionService } from '../transcription/transcription.service.js';
import { CampaignMonitorService } from '../campaign-monitor/campaign-monitor.service.js';

@Injectable()
export class BotCommandsService {
  private readonly logger = new Logger(BotCommandsService.name);

  constructor(
    private readonly td: TrackDriveService,
    private readonly prisma: PrismaService,
    private readonly helpers: BotHelpersService,
    private readonly transcription: TranscriptionService,
    private readonly campaignMonitor: CampaignMonitorService,
  ) {}

  async handleHelp(chatId: string): Promise<void> {
    const msg = `<b>GrovLabs TrackDrive Assistant</b>\n\n` +
      `<b>Analytics</b>\n` +
      `/overview — System dashboard\n` +
      `/stats [today|week|month] — Call volume and conversions\n` +
      `/revenue [today|week|2weeks|month] — Revenue breakdown\n` +
      `/report [offer] — Full campaign report\n\n` +
      `<b>Optimization</b>\n` +
      `/goal [amount] — Set/check daily revenue goal\n` +
      `/margins [offer|vendor] — Profit margin analysis\n\n` +
      `<b>Automation</b>\n` +
      `/alerts [on|off|status] — Proactive alert system\n\n` +
      `<b>Vendors</b>\n` +
      `/vendors — List all traffic sources\n` +
      `/pause [name] — Pause a traffic source\n` +
      `/unpause [name] — Unpause a traffic source\n` +
      `/newvendor [company name] — Create new vendor\n\n` +
      `<b>Offers</b>\n` +
      `/offers — List all offers\n\n` +
      `<b>QA</b>\n` +
      `/flagged [count] — Recent flagged calls\n\n` +
      `<b>RTB Monitor</b>\n` +
      `/rtbstats [today|yesterday|week|month] — RTB campaign performance\n\n` +
      `<b>Onboarding</b>\n` +
      `/applications [pending|approved|rejected] — Vendor applications\n`;
    await this.helpers.send(chatId, msg);
  }

  // ==================== OVERVIEW ====================
  async handleOverview(chatId: string): Promise<void> {
    await this.helpers.send(chatId, '⏳ Pulling system overview...');

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();

    const [calls, offers, trafficSources, buyers] = await Promise.all([
      this.td.fetchAllCallsForRange(today, tomorrow),
      this.td.listOffers({ per_page: 50 }),
      this.td.listTrafficSources({ per_page: 50 }),
      this.td.listBuyers(),
    ]);

    const totalCalls = calls.length;
    const converted = calls.filter(c => c.buyer_converted === 'Converted').length;
    const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const totalPay = calls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
    const profit = totalRev - totalPay;
    const avgDur = totalCalls > 0 ? Math.round(calls.reduce((s, c) => s + (c.total_duration || 0), 0) / totalCalls) : 0;
    const convRate = totalCalls > 0 ? ((converted / totalCalls) * 100).toFixed(1) : '0';

    const offerStats = this.helpers.groupBy(calls, 'offer');
    let offerLines = '';
    for (const [name, oCalls] of Object.entries(offerStats).sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length)) {
      const oc = oCalls as any[];
      const oRev = oc.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const oConv = oc.filter((c: any) => c.buyer_converted === 'Converted').length;
      offerLines += `  📋 ${this.helpers.esc(name)}: ${oc.length} calls | $${oRev.toFixed(0)} rev | ${oConv} conv\n`;
    }

    const activeOffers = (offers?.offers || []).filter((o: any) => !o.paused).length;
    const totalOffers = (offers?.offers || []).length;
    const activeTS = (trafficSources?.traffic_sources || []).length;
    const totalBuyers = (buyers?.buyers || []).length;

    const flaggedToday = await this.prisma.flag.count({
      where: { created_at: { gte: new Date(today) } },
    });

    // Goal check
    const goalSetting = await this.prisma.bot_setting.findUnique({ where: { key: 'daily_goal' } });
    const goalAmt = goalSetting ? parseFloat(goalSetting.value) : 0;
    const goalLine = goalAmt > 0
      ? `\n🎯 Goal: $${goalAmt.toFixed(0)} | Progress: <b>$${totalRev.toFixed(0)}</b> (${((totalRev / goalAmt) * 100).toFixed(0)}%)\n`
      : '';

    const msg = `🤖 <b>GROVLABS SYSTEM OVERVIEW</b>\n` +
      `📅 ${today}\n${goalLine}\n` +
      `<b>📊 Today's Numbers</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📞 Calls: <b>${totalCalls}</b> | ✅ Converted: <b>${converted}</b> (${convRate}%)\n` +
      `💰 Revenue: <b>$${totalRev.toFixed(2)}</b>\n` +
      `💸 Payouts: <b>$${totalPay.toFixed(2)}</b>\n` +
      `📈 Profit: <b>$${profit.toFixed(2)}</b>\n` +
      `⏱ Avg Duration: ${avgDur}s\n` +
      `🚩 Flagged: ${flaggedToday}\n\n` +
      `<b>📋 Offers Today</b>\n${offerLines}\n` +
      `<b>⚙️ System</b>\n` +
      `  Offers: ${activeOffers}/${totalOffers} active\n` +
      `  Vendors: ${activeTS}\n` +
      `  Buyers: ${totalBuyers}\n`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== STATS ====================
  async handleStats(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange(args || 'today');
    await this.helpers.send(chatId, `⏳ Pulling stats for ${range.label}...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    const total = calls.length;
    const converted = calls.filter(c => c.buyer_converted === 'Converted').length;
    const noAnswer = calls.filter(c => !c.buyer_id || c.buyer_converted === null).length;
    const dropped = calls.filter(c => c.hangup_cause?.includes('caller hungup') && (c.total_duration || 0) < 30).length;
    const avgDur = total > 0 ? Math.round(calls.reduce((s, c) => s + (c.total_duration || 0), 0) / total) : 0;
    const convRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

    let dailyBreakdown = '';
    if (range.days > 1) {
      const byDay = this.helpers.groupByDate(calls);
      for (const [day, dayCalls] of Object.entries(byDay).sort()) {
        const dc = dayCalls as any[];
        const dConv = dc.filter((c: any) => c.buyer_converted === 'Converted').length;
        const dRev = dc.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        dailyBreakdown += `  📅 ${day}: ${dc.length} calls | ${dConv} conv | $${dRev.toFixed(0)}\n`;
      }
      dailyBreakdown = `\n<b>📅 Daily Breakdown</b>\n${dailyBreakdown}`;
    }

    const msg = `📊 <b>CALL STATS — ${range.label.toUpperCase()}</b>\n\n` +
      `📞 Total Calls: <b>${total}</b>\n` +
      `✅ Converted: <b>${converted}</b> (${convRate}%)\n` +
      `📵 No Answer/No Buyer: ${noAnswer}\n` +
      `📴 Dropped (<30s): ${dropped}\n` +
      `⏱ Avg Duration: ${avgDur}s\n` +
      dailyBreakdown;

    await this.helpers.send(chatId, msg);
  }

  // ==================== REVENUE ====================
  async handleRevenue(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange(args || 'today');
    await this.helpers.send(chatId, `⏳ Pulling revenue for ${range.label}...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const totalPay = calls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
    const profit = totalRev - totalPay;
    const margin = totalRev > 0 ? ((profit / totalRev) * 100).toFixed(1) : '0';

    const byOffer = this.helpers.groupBy(calls, 'offer');
    let offerLines = '';
    const offerEntries = Object.entries(byOffer)
      .map(([name, oc]) => {
        const arr = oc as any[];
        return {
          name,
          rev: arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0),
          pay: arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0),
          calls: arr.length,
          conv: arr.filter((c: any) => c.buyer_converted === 'Converted').length,
        };
      })
      .sort((a, b) => b.rev - a.rev);

    for (const o of offerEntries) {
      offerLines += `  📋 ${this.helpers.esc(o.name)}\n`;
      offerLines += `     ${o.calls} calls | ${o.conv} conv | Rev: $${o.rev.toFixed(2)} | Pay: $${o.pay.toFixed(2)} | Profit: $${(o.rev - o.pay).toFixed(2)}\n`;
    }

    const byVendor = this.helpers.groupBy(calls.filter(c => (Number(c.payout) || 0) > 0), 'traffic_source');
    let vendorLines = '';
    const vendorEntries = Object.entries(byVendor)
      .map(([name, vc]) => ({
        name,
        pay: (vc as any[]).reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0),
        calls: (vc as any[]).length,
      }))
      .sort((a, b) => b.pay - a.pay)
      .slice(0, 10);

    for (const v of vendorEntries) {
      vendorLines += `  👤 ${this.helpers.esc(v.name)}: $${v.pay.toFixed(2)} (${v.calls} calls)\n`;
    }

    const msg = `💰 <b>REVENUE — ${range.label.toUpperCase()}</b>\n\n` +
      `💵 Revenue: <b>$${totalRev.toFixed(2)}</b>\n` +
      `💸 Payouts: <b>$${totalPay.toFixed(2)}</b>\n` +
      `📈 Profit: <b>$${profit.toFixed(2)}</b> (${margin}% margin)\n\n` +
      `<b>📋 By Offer</b>\n${offerLines}\n` +
      `<b>👤 Top Vendor Payouts</b>\n${vendorLines}`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== FLAGGED ====================
  async handleFlagged(chatId: string, args: string): Promise<void> {
    const limit = Math.min(parseInt(args) || 10, 20);

    const flags = await this.prisma.flag.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        call: { select: { trackdrive_call_id: true, caller_number: true, duration: true, campaign_name: true } },
        affiliate: { select: { name: true } },
      },
    });

    if (flags.length === 0) {
      await this.helpers.send(chatId, '✅ No flagged calls found.');
      return;
    }

    let msg = `🚩 <b>RECENT FLAGGED CALLS</b> (${flags.length})\n\n`;
    for (const f of flags) {
      const emoji = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '🔵';
      msg += `${emoji} ${f.call?.caller_number || '?'} | ${f.call?.duration || 0}s | ${this.helpers.esc(f.call?.campaign_name || '?')}\n`;
      msg += `   ${this.helpers.esc(f.affiliate?.name || '?')} | ${f.severity}\n`;
      msg += `   ${this.helpers.esc((f.details || '').substring(0, 80))}\n`;
      msg += `   <code>${f.call?.trackdrive_call_id || '?'}</code> | ${this.helpers.fmtDate(f.created_at)}\n\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== VENDOR ====================
  async handleVendor(chatId: string, args: string): Promise<void> {
    if (!args) {
      await this.helpers.send(chatId, 'Usage: /vendor [name or ID]');
      return;
    }

    await this.helpers.send(chatId, `⏳ Looking up vendor: ${args}...`);

    const tsData = await this.td.listTrafficSources({ per_page: 50 });
    const allTS = tsData?.traffic_sources || [];
    const match = allTS.find((ts: any) =>
      ts.name?.toLowerCase().includes(args.toLowerCase()) ||
      String(ts.id) === args ||
      ts.user_traffic_source_id === args
    );

    if (!match) {
      await this.helpers.send(chatId, `❌ Vendor not found: ${this.helpers.esc(args)}`);
      return;
    }

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const todayCalls = await this.td.fetchAllCallsForRange(today, tomorrow);
    const vendorCalls = todayCalls.filter(c => String(c.traffic_source_id) === String(match.id));

    const totalCalls = vendorCalls.length;
    const converted = vendorCalls.filter(c => c.buyer_converted === 'Converted').length;
    const rev = vendorCalls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const pay = vendorCalls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
    const avgDur = totalCalls > 0 ? Math.round(vendorCalls.reduce((s, c) => s + (c.total_duration || 0), 0) / totalCalls) : 0;

    const dbAffiliate = await this.prisma.affiliate.findFirst({
      where: { trackdrive_id: String(match.id) },
    });
    const flagCount = dbAffiliate?.flagged_calls || 0;
    const totalDBCalls = dbAffiliate?.total_calls || 0;

    const statusEmoji = match.paused ? '⏸️ PAUSED' : '✅ ACTIVE';

    const msg = `👤 <b>VENDOR: ${this.helpers.esc(match.name)}</b>\n` +
      `${statusEmoji} | ID: ${match.id}\n\n` +
      `<b>📊 Today's Performance</b>\n` +
      `📞 Calls: ${totalCalls} | ✅ Converted: ${converted}\n` +
      `💰 Revenue: $${rev.toFixed(2)} | 💸 Payout: $${pay.toFixed(2)}\n` +
      `⏱ Avg Duration: ${avgDur}s\n\n` +
      `<b>🚩 QA History</b>\n` +
      `Total Calls Analyzed: ${totalDBCalls}\n` +
      `Flagged: ${flagCount}\n` +
      `Flag Rate: ${totalDBCalls > 0 ? ((flagCount / totalDBCalls) * 100).toFixed(1) : '0'}%\n` +
      (dbAffiliate?.high_sensitivity_until && new Date(dbAffiliate.high_sensitivity_until) > new Date()
        ? `\n⚠️ <b>HIGH SENSITIVITY MONITORING ACTIVE</b>\n` : '') +
      `\n📞 Numbers: ${match.numbers_count || 0}\n` +
      `🕐 Last Call: ${match.last_call_at || 'Never'}`;

    await this.helpers.send(chatId, msg);
  }

  async handleVendorList(chatId: string): Promise<void> {
    const data = await this.td.listTrafficSources({ per_page: 50 });
    const sources = data?.traffic_sources || [];

    if (sources.length === 0) {
      await this.helpers.send(chatId, 'No traffic sources found.');
      return;
    }

    let msg = `👤 <b>TRAFFIC SOURCES</b> (${sources.length})\n\n`;
    for (const ts of sources) {
      const status = ts.paused ? '⏸️' : '✅';
      msg += `${status} ${this.helpers.esc(ts.name)} — ${ts.calls_count || 0} calls | ${ts.numbers_count || 0} numbers\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== PAUSE/UNPAUSE ====================
  async handlePause(chatId: string, args: string): Promise<void> {
    if (!args) {
      await this.helpers.send(chatId, 'Usage: /pause [vendor name or ID]');
      return;
    }

    const ts = await this.helpers.findTrafficSource(args);
    if (!ts) {
      await this.helpers.send(chatId, `❌ Vendor not found: ${this.helpers.esc(args)}`);
      return;
    }

    await this.td.pauseTrafficSource(String(ts.id), true);
    await this.helpers.send(chatId, `⏸️ <b>PAUSED:</b> ${this.helpers.esc(ts.name)} (ID: ${ts.id})`);
  }

  async handleUnpause(chatId: string, args: string): Promise<void> {
    if (!args) {
      await this.helpers.send(chatId, 'Usage: /unpause [vendor name or ID]');
      return;
    }

    const ts = await this.helpers.findTrafficSource(args);
    if (!ts) {
      await this.helpers.send(chatId, `❌ Vendor not found: ${this.helpers.esc(args)}`);
      return;
    }

    await this.td.pauseTrafficSource(String(ts.id), false);
    await this.helpers.send(chatId, `✅ <b>UNPAUSED:</b> ${this.helpers.esc(ts.name)} (ID: ${ts.id})`);
  }

  // ==================== NEW VENDOR ====================
  async handleNewVendor(chatId: string, args: string): Promise<void> {
    if (!args) {
      await this.helpers.send(chatId, 'Usage: /newvendor [company name]');
      return;
    }

    const result = await this.td.createTrafficSource({ company_name: args });
    // Response may have traffic_source wrapper or be top-level
    const ts = result?.traffic_source || result;
    if (ts?.id) {
      await this.helpers.send(chatId, `<b>VENDOR CREATED:</b> ${this.helpers.esc(ts.company_name || ts.name || args)}\nID: ${ts.id}`);
    } else {
      await this.helpers.send(chatId, `Failed to create vendor. Check logs.`);
    }
  }

  // ==================== OFFERS ====================
  async handleOffers(chatId: string): Promise<void> {
    const data = await this.td.listOffers({ per_page: 50 });
    const offers = data?.offers || [];

    if (offers.length === 0) {
      await this.helpers.send(chatId, 'No offers found.');
      return;
    }

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const todayCalls = await this.td.fetchAllCallsForRange(today, tomorrow);
    const byOffer = this.helpers.groupBy(todayCalls, 'offer');

    let msg = `📋 <b>OFFERS</b> (${offers.length})\n\n`;
    for (const o of offers) {
      const status = o.paused ? '⏸️' : '✅';
      const oCalls = (byOffer[o.name] || []) as any[];
      const oRev = oCalls.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const oConv = oCalls.filter((c: any) => c.buyer_converted === 'Converted').length;
      msg += `${status} <b>${this.helpers.esc(o.name)}</b>\n`;
      msg += `   Today: ${oCalls.length} calls | ${oConv} conv | $${oRev.toFixed(0)} rev\n`;
      msg += `   Buyers: ${o.buyers_count || 0} | CC: ${o.active_cc_count || 0}/${o.max_cc_count || 0}\n\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  async handleNewOffer(chatId: string, args: string): Promise<void> {
    if (!args) {
      await this.helpers.send(chatId, 'Usage: /newoffer [offer name]');
      return;
    }

    const result = await this.td.createOffer({ name: args });
    const offer = result?.offer;
    if (offer) {
      await this.helpers.send(chatId, `✅ <b>OFFER CREATED:</b> ${this.helpers.esc(offer.name)}\nID: ${offer.id}`);
    } else {
      await this.helpers.send(chatId, `❌ Failed to create offer. Check logs.`);
    }
  }

  // ==================== CLIENTS/BUYERS ====================
  async handleClients(chatId: string, args: string): Promise<void> {
    await this.helpers.send(chatId, '⏳ Analyzing buyer performance...');

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const calls = await this.td.fetchAllCallsForRange(today, tomorrow);

    const byBuyer = this.helpers.groupBy(calls.filter(c => c.buyer), 'buyer');
    const buyerStats = Object.entries(byBuyer)
      .map(([name, bc]) => {
        const arr = bc as any[];
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
        const noAnswer = arr.filter((c: any) => (c.total_duration || 0) < 10).length;
        const dropped = arr.filter((c: any) => c.hangup_cause?.includes('buyer') && c.hangup_cause?.includes('hungup') && (c.total_duration || 0) < 30).length;
        const avgDur = arr.length > 0 ? Math.round(arr.reduce((s: number, c: any) => s + (c.total_duration || 0), 0) / arr.length) : 0;
        return { name, calls: arr.length, rev, conv, noAnswer, dropped, avgDur, convRate: arr.length > 0 ? (conv / arr.length * 100) : 0 };
      })
      .sort((a, b) => args === 'worst' ? a.convRate - b.convRate : b.rev - a.rev);

    const sortLabel = args === 'worst' ? 'WORST PERFORMING' : 'BEST PERFORMING';
    let msg = `🏢 <b>BUYERS — ${sortLabel}</b> (Today)\n\n`;

    for (const b of buyerStats.slice(0, 15)) {
      const convRate = b.convRate.toFixed(1);
      msg += `<b>${this.helpers.esc(b.name)}</b>\n`;
      msg += `  📞 ${b.calls} calls | ✅ ${b.conv} conv (${convRate}%) | 💰 $${b.rev.toFixed(0)}\n`;
      msg += `  📵 No answer: ${b.noAnswer} | 📴 Dropped: ${b.dropped} | ⏱ ${b.avgDur}s avg\n\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== ZIPS/STATES ====================
  async handleZips(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange('week');
    await this.helpers.send(chatId, `⏳ Analyzing state performance (past week)...`);

    let calls = await this.td.fetchAllCallsForRange(range.from, range.to);

    if (args) {
      calls = calls.filter(c => (c.offer || '').toLowerCase().includes(args.toLowerCase()));
    }

    const byState: Record<string, any[]> = {};
    for (const c of calls) {
      const state = c['token-state'] || c['token-geo_state']?.replace('us-', '').toUpperCase() || 'UNKNOWN';
      if (!byState[state]) byState[state] = [];
      byState[state].push(c);
    }

    const stateStats = Object.entries(byState)
      .map(([state, sc]) => {
        const rev = sc.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
        const conv = sc.filter(c => c.buyer_converted === 'Converted').length;
        return { state, calls: sc.length, rev, conv, convRate: sc.length > 0 ? (conv / sc.length * 100) : 0 };
      })
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 20);

    const offerLabel = args ? ` — ${args.toUpperCase()}` : '';
    let msg = `📍 <b>TOP STATES${offerLabel}</b> (Past Week)\n\n`;
    for (const s of stateStats) {
      msg += `  <b>${s.state}</b>: ${s.calls} calls | ${s.conv} conv (${s.convRate.toFixed(0)}%) | $${s.rev.toFixed(0)}\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== REPORT ====================
  async handleReport(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange('today');
    await this.helpers.send(chatId, `⏳ Building full report${args ? ` for ${args}` : ''}...`);

    let calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    if (args) {
      calls = calls.filter(c => (c.offer || '').toLowerCase().includes(args.toLowerCase()));
    }

    const total = calls.length;
    const converted = calls.filter(c => c.buyer_converted === 'Converted').length;
    const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const totalPay = calls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
    const noAnswer = calls.filter(c => (c.total_duration || 0) < 10).length;
    const dropped = calls.filter(c => c.hangup_cause?.includes('caller hungup') && (c.total_duration || 0) < 30).length;

    const byVendor = this.helpers.groupBy(calls, 'traffic_source');
    let vendorLines = '';
    const vendorArr = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        return {
          name,
          calls: arr.length,
          conv: arr.filter((c: any) => c.buyer_converted === 'Converted').length,
          rev: arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0),
          pay: arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0),
        };
      })
      .sort((a, b) => b.rev - a.rev);

    for (const v of vendorArr.slice(0, 10)) {
      vendorLines += `  👤 ${this.helpers.esc(v.name)}: ${v.calls} calls | ${v.conv} conv | R:$${v.rev.toFixed(0)} P:$${v.pay.toFixed(0)}\n`;
    }

    const byBuyer = this.helpers.groupBy(calls.filter(c => c.buyer), 'buyer');
    let buyerLines = '';
    for (const [name, bc] of Object.entries(byBuyer).sort((a, b) => (b[1] as any[]).length - (a[1] as any[]).length).slice(0, 10)) {
      const arr = bc as any[];
      const bRev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const bConv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
      const bNoAns = arr.filter((c: any) => (c.total_duration || 0) < 10).length;
      buyerLines += `  🏢 ${this.helpers.esc(name)}: ${arr.length} calls | ${bConv} conv | $${bRev.toFixed(0)} | ${bNoAns} no-answer\n`;
    }

    const offerLabel = args ? args.toUpperCase() : 'ALL OFFERS';
    const msg = `📊 <b>FULL REPORT — ${offerLabel}</b>\n` +
      `📅 ${range.label}\n\n` +
      `<b>📈 Summary</b>\n` +
      `📞 Total: ${total} | ✅ Conv: ${converted} | 📵 No-Ans: ${noAnswer} | 📴 Dropped: ${dropped}\n` +
      `💰 Rev: $${totalRev.toFixed(2)} | 💸 Pay: $${totalPay.toFixed(2)} | 📈 Profit: $${(totalRev - totalPay).toFixed(2)}\n\n` +
      `<b>👤 Vendors</b>\n${vendorLines}\n` +
      `<b>🏢 Buyers</b>\n${buyerLines}`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== EOD REPORT ====================
  async handleEOD(chatId: string): Promise<void> {
    await this.helpers.send(chatId, '⏳ Generating end-of-day report...');
    const report = await this.buildEODReport();
    await this.helpers.send(chatId, report);
  }

  async buildEODReport(): Promise<string> {
    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const calls = await this.td.fetchAllCallsForRange(today, tomorrow);

    const total = calls.length;
    const converted = calls.filter(c => c.buyer_converted === 'Converted').length;
    const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const totalPay = calls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
    const profit = totalRev - totalPay;
    const noAnswer = calls.filter(c => (c.total_duration || 0) < 10).length;
    const dropped = calls.filter(c => c.hangup_cause?.includes('caller hungup') && (c.total_duration || 0) < 30).length;
    const avgDur = total > 0 ? Math.round(calls.reduce((s, c) => s + (c.total_duration || 0), 0) / total) : 0;

    const flaggedToday = await this.prisma.flag.count({
      where: { created_at: { gte: new Date(today) } },
    });

    // Goal check
    const goalSetting = await this.prisma.bot_setting.findUnique({ where: { key: 'daily_goal' } });
    const goalAmt = goalSetting ? parseFloat(goalSetting.value) : 0;
    const goalLine = goalAmt > 0
      ? `🎯 Goal: $${goalAmt.toFixed(0)} | Result: <b>$${totalRev.toFixed(0)}</b> (${((totalRev / goalAmt) * 100).toFixed(0)}%) ${totalRev >= goalAmt ? '✅ HIT!' : '❌ Missed'}\n`
      : '';

    const byOffer = this.helpers.groupBy(calls, 'offer');
    const offerStats = Object.entries(byOffer)
      .map(([name, oc]) => {
        const arr = oc as any[];
        return {
          name,
          calls: arr.length,
          conv: arr.filter((c: any) => c.buyer_converted === 'Converted').length,
          rev: arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0),
          pay: arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0),
        };
      })
      .sort((a, b) => b.rev - a.rev);

    let offerLines = '';
    for (const o of offerStats) {
      const convRate = o.calls > 0 ? ((o.conv / o.calls) * 100).toFixed(0) : '0';
      offerLines += `  📋 ${this.helpers.esc(o.name)}: ${o.calls} calls | ${o.conv} conv (${convRate}%) | $${o.rev.toFixed(0)} rev\n`;
    }

    const byVendor = this.helpers.groupBy(calls, 'traffic_source');
    const vendorStats = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
        return { name, calls: arr.length, conv, convRate: arr.length > 0 ? (conv / arr.length * 100) : 0,
          pay: arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0) };
      })
      .filter(v => v.calls >= 3);

    const worstVendors = [...vendorStats].sort((a, b) => a.convRate - b.convRate).slice(0, 5);
    const bestVendors = [...vendorStats].sort((a, b) => b.convRate - a.convRate).slice(0, 5);

    let worstLines = '';
    for (const v of worstVendors) {
      worstLines += `  ⚠️ ${this.helpers.esc(v.name)}: ${v.calls} calls | ${v.conv} conv (${v.convRate.toFixed(0)}%)\n`;
    }
    let bestLines = '';
    for (const v of bestVendors) {
      bestLines += `  ⭐ ${this.helpers.esc(v.name)}: ${v.calls} calls | ${v.conv} conv (${v.convRate.toFixed(0)}%)\n`;
    }

    const byBuyer = this.helpers.groupBy(calls.filter(c => c.buyer), 'buyer');
    let buyerLines = '';
    const buyerArr = Object.entries(byBuyer)
      .map(([name, bc]) => {
        const arr = bc as any[];
        const classified = this.helpers.classifyCalls(arr);
        const actualAnswered = classified.converted.length + classified.answered.length;
        const ivrRejected = classified.ivr_rejected.length;
        const ivrFailed = classified.ivr_failed.length;
        const noAns = classified.no_answer.length;
        const wasted = ivrRejected + ivrFailed + noAns;
        const answerRate = arr.length > 0 ? (actualAnswered / arr.length * 100) : 0;
        return { name, calls: arr.length, actualAnswered, ivrRejected, ivrFailed, noAns, wasted, answerRate };
      })
      .sort((a, b) => a.answerRate - b.answerRate);

    for (const b of buyerArr.slice(0, 8)) {
      const emoji = b.answerRate >= 80 ? '🟢' : b.answerRate >= 60 ? '🟡' : '🔴';
      buyerLines += `  ${emoji} ${this.helpers.esc(b.name)}: ${b.calls} calls | ${b.answerRate.toFixed(0)}% answered | 🔴${b.ivrRejected} rej 🟡${b.ivrFailed} fail 📵${b.noAns}\n`;
    }

    return `🤖 <b>END OF DAY REPORT</b>\n` +
      `📅 ${today}\n${goalLine}\n` +
      `<b>📊 Day Summary</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📞 Total: <b>${total}</b> | ✅ Conv: <b>${converted}</b> (${total > 0 ? ((converted/total)*100).toFixed(0) : 0}%)\n` +
      `💰 Rev: <b>$${totalRev.toFixed(2)}</b> | 💸 Pay: <b>$${totalPay.toFixed(2)}</b> | 📈 Profit: <b>$${profit.toFixed(2)}</b>\n` +
      `⏱ Avg Duration: ${avgDur}s | 📵 No-Answer: ${noAnswer} | 📴 Dropped: ${dropped}\n` +
      `🚩 Flagged: ${flaggedToday}\n\n` +
      `<b>📋 Campaign Performance</b>\n${offerLines}\n` +
      `<b>⭐ Best Vendors</b>\n${bestLines}\n` +
      `<b>⚠️ Underperforming Vendors</b>\n${worstLines}\n` +
      `<b>🏢 Buyer Answer Rates</b>\n${buyerLines}`;
  }

  // ================================================================
  //  NEW PHASE 2 SCALING COMMANDS
  // ================================================================

  // ==================== 1. SCORECARD ====================
  async handleScorecard(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange(args ? 'week' : 'week');
    await this.helpers.send(chatId, `⏳ Building vendor scorecards (past week)...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');

    let scorecards: Array<{ name: string; calls: number; conv: number; convRate: number; revPerCall: number; profitPerCall: number; avgDur: number; dupRate: number; grade: string }> = [];

    for (const [name, vc] of Object.entries(byVendor)) {
      const arr = vc as any[];
      if (args && !name.toLowerCase().includes(args.toLowerCase())) continue;

      const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
      const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
      const avgDur = arr.length > 0 ? Math.round(arr.reduce((s: number, c: any) => s + (c.total_duration || 0), 0) / arr.length) : 0;

      // Duplicate detection - same caller_number from this vendor
      const callerNumbers = arr.map((c: any) => c.caller_number).filter(Boolean);
      const uniqueCallers = new Set(callerNumbers).size;
      const dupRate = callerNumbers.length > 0 ? ((callerNumbers.length - uniqueCallers) / callerNumbers.length) * 100 : 0;

      const convRate = arr.length > 0 ? (conv / arr.length) * 100 : 0;
      const revPerCall = arr.length > 0 ? rev / arr.length : 0;
      const profitPerCall = arr.length > 0 ? (rev - pay) / arr.length : 0;

      // Grade: weighted score from conv rate (40%), rev per call (25%), avg dur (20%), dup penalty (15%)
      let score = 0;
      score += Math.min(convRate / 30 * 40, 40); // 30%+ conv = max 40 pts
      score += Math.min(revPerCall / 20 * 25, 25); // $20+ per call = max 25 pts
      score += Math.min(avgDur / 120 * 20, 20); // 120s+ avg = max 20 pts
      score -= Math.min(dupRate / 20 * 15, 15); // 20%+ dups = -15 pts

      let grade = 'F';
      if (score >= 75) grade = 'A';
      else if (score >= 60) grade = 'B';
      else if (score >= 45) grade = 'C';
      else if (score >= 30) grade = 'D';

      scorecards.push({ name, calls: arr.length, conv, convRate, revPerCall, profitPerCall, avgDur, dupRate, grade });
    }

    scorecards = scorecards.sort((a, b) => {
      const gradeOrder: Record<string, number> = { 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
      return (gradeOrder[b.grade] || 0) - (gradeOrder[a.grade] || 0);
    });

    if (scorecards.length === 0) {
      await this.helpers.send(chatId, '❌ No vendor data found for the period.');
      return;
    }

    const gradeEmoji: Record<string, string> = { 'A': '🟢', 'B': '🔵', 'C': '🟡', 'D': '🟠', 'F': '🔴' };

    let msg = `📊 <b>VENDOR SCORECARDS</b> (Past Week)\n\n`;
    for (const s of scorecards.slice(0, 20)) {
      msg += `${gradeEmoji[s.grade] || '⚪'} <b>${s.grade}</b> — ${this.helpers.esc(s.name)}\n`;
      msg += `   📞 ${s.calls} calls | ✅ ${s.convRate.toFixed(1)}% conv | 💰 $${s.revPerCall.toFixed(2)}/call\n`;
      msg += `   📈 $${s.profitPerCall.toFixed(2)} profit/call | ⏱ ${s.avgDur}s avg | 🔄 ${s.dupRate.toFixed(0)}% dups\n\n`;
    }

    const aCount = scorecards.filter(s => s.grade === 'A').length;
    const fCount = scorecards.filter(s => s.grade === 'F').length;
    msg += `\n<b>Summary:</b> ${aCount} A-grade | ${fCount} F-grade | ${scorecards.length} total vendors`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 2. ANSWER RATE ====================
  async handleAnswerRate(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange(args || 'today');
    await this.helpers.send(chatId, `⏳ Analyzing buyer answer rates (${range.label})...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);

    // Group by buyer - include all calls that were routed to a buyer
    const byBuyer = this.helpers.groupBy(calls.filter(c => c.buyer), 'buyer');

    const buyerRates = Object.entries(byBuyer)
      .map(([name, bc]) => {
        const arr = bc as any[];
        // Use smart classification
        const classified = this.helpers.classifyCalls(arr);
        const actualAnswered = classified.converted.length + classified.answered.length;
        const ivrRejected = classified.ivr_rejected.length;
        const ivrFailed = classified.ivr_failed.length;
        const noAnswer = classified.no_answer.length;
        const wasted = ivrRejected + ivrFailed + noAnswer;

        const converted = classified.converted.length;
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const avgConvValue = converted > 0 ? rev / converted : 0;
        const missedRevEst = wasted * avgConvValue * (converted / Math.max(actualAnswered, 1));

        const realAnswerRate = arr.length > 0 ? (actualAnswered / arr.length) * 100 : 0;

        return {
          name,
          total: arr.length,
          actualAnswered,
          converted,
          ivrRejected,
          ivrFailed,
          noAnswer,
          wasted,
          answerRate: realAnswerRate,
          rev,
          missedRevEst,
        };
      })
      .sort((a, b) => a.answerRate - b.answerRate);

    let msg = `📞 <b>BUYER ANSWER RATES — ${range.label.toUpperCase()}</b>\n\n`;

    const totalWasted = buyerRates.reduce((s, b) => s + b.wasted, 0);
    const totalMissedRev = buyerRates.reduce((s, b) => s + b.missedRevEst, 0);
    const totalIvrRej = buyerRates.reduce((s, b) => s + b.ivrRejected, 0);
    const totalIvrFail = buyerRates.reduce((s, b) => s + b.ivrFailed, 0);

    msg += `<b>⚠️ Est. Revenue Lost: $${totalMissedRev.toFixed(0)}</b>\n`;
    msg += `🔴 IVR Rejected: ${totalIvrRej} | 🟡 IVR Failed: ${totalIvrFail} | 📵 No Answer: ${buyerRates.reduce((s, b) => s + b.noAnswer, 0)}\n\n`;

    for (const b of buyerRates) {
      const emoji = b.answerRate >= 80 ? '🟢' : b.answerRate >= 60 ? '🟡' : '🔴';
      msg += `${emoji} <b>${this.helpers.esc(b.name)}</b>\n`;
      msg += `   📞 ${b.total} routed | ✅ ${b.actualAnswered} answered (<b>${b.answerRate.toFixed(0)}%</b>) | ${b.converted} conv\n`;
      msg += `   🔴 ${b.ivrRejected} IVR reject | 🟡 ${b.ivrFailed} IVR fail | 📵 ${b.noAnswer} no-answer\n`;
      msg += `   💰 $${b.rev.toFixed(0)} rev | 💸 ~$${b.missedRevEst.toFixed(0)} est. lost\n\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== 3. GOAL ====================
  async handleGoal(chatId: string, args: string): Promise<void> {
    // Set goal: /goal 2000
    if (args && !isNaN(parseFloat(args))) {
      const amount = parseFloat(args);
      await this.prisma.bot_setting.upsert({
        where: { key: 'daily_goal' },
        create: { key: 'daily_goal', value: String(amount) },
        update: { value: String(amount) },
      });
      await this.helpers.send(chatId, `🎯 Daily revenue goal set to <b>$${amount.toFixed(0)}</b>`);
      return;
    }

    // Show current goal progress
    const goalSetting = await this.prisma.bot_setting.findUnique({ where: { key: 'daily_goal' } });
    if (!goalSetting) {
      await this.helpers.send(chatId, '🎯 No daily goal set. Use /goal [amount] to set one.\nExample: /goal 2000');
      return;
    }

    const goalAmt = parseFloat(goalSetting.value);
    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const calls = await this.td.fetchAllCallsForRange(today, tomorrow);

    const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const converted = calls.filter(c => c.buyer_converted === 'Converted').length;
    const progress = goalAmt > 0 ? (totalRev / goalAmt) * 100 : 0;

    // Calculate pace - hours elapsed and projected
    const now = new Date();
    const pstHour = (now.getUTCHours() - 7 + 24) % 24;
    const businessStart = 7; // 7am PST
    const businessEnd = 19; // 7pm PST
    const hoursElapsed = Math.max(pstHour - businessStart, 0.5);
    const totalBizHours = businessEnd - businessStart;
    const hourlyRate = totalRev / hoursElapsed;
    const projected = hourlyRate * totalBizHours;

    // How many more converted calls needed
    const avgConvValue = converted > 0 ? totalRev / converted : 0;
    const remaining = Math.max(goalAmt - totalRev, 0);
    const callsNeeded = avgConvValue > 0 ? Math.ceil(remaining / avgConvValue) : 0;

    const progressBar = this.helpers.progressBar(progress);
    const onTrack = projected >= goalAmt;

    const msg = `🎯 <b>DAILY REVENUE GOAL</b>\n\n` +
      `Target: <b>$${goalAmt.toFixed(0)}</b>\n` +
      `Current: <b>$${totalRev.toFixed(2)}</b>\n` +
      `${progressBar} ${progress.toFixed(0)}%\n\n` +
      `<b>📈 Pace Analysis</b>\n` +
      `⏰ ${pstHour > 12 ? pstHour - 12 : pstHour}${pstHour >= 12 ? 'pm' : 'am'} PST (${hoursElapsed.toFixed(1)}hrs in)\n` +
      `💵 Hourly Rate: $${hourlyRate.toFixed(0)}/hr\n` +
      `📊 Projected EOD: <b>$${projected.toFixed(0)}</b> ${onTrack ? '✅ ON TRACK' : '⚠️ BEHIND PACE'}\n` +
      `${remaining > 0 ? `\n🏁 Need <b>$${remaining.toFixed(0)}</b> more` + (callsNeeded > 0 ? ` (~${callsNeeded} more converted calls)` : '') : '\n🎉 <b>GOAL REACHED!</b>'}\n` +
      `\n📞 ${calls.length} total calls | ✅ ${converted} converted | 💰 $${(converted > 0 ? totalRev / converted : 0).toFixed(0)} avg value`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 4. DEADWEIGHT ====================
  async handleDeadweight(chatId: string): Promise<void> {
    await this.helpers.send(chatId, '⏳ Finding vendors costing you money (past week)...');

    const range = this.helpers.parseRange('week');
    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');

    const deadweight: Array<{ name: string; reason: string; calls: number; rev: number; pay: number; convRate: number; dupRate: number }> = [];

    for (const [name, vc] of Object.entries(byVendor)) {
      const arr = vc as any[];
      const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
      const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
      const convRate = arr.length > 0 ? (conv / arr.length) * 100 : 0;

      // Duplicate detection
      const callerNumbers = arr.map((c: any) => c.caller_number).filter(Boolean);
      const uniqueCallers = new Set(callerNumbers).size;
      const dupRate = callerNumbers.length > 0 ? ((callerNumbers.length - uniqueCallers) / callerNumbers.length) * 100 : 0;

      const reasons: string[] = [];

      // 0% conversion with 10+ calls
      if (convRate === 0 && arr.length >= 10) reasons.push('0% conversion (10+ calls)');
      // Negative margin
      if (rev < pay && pay > 0) reasons.push(`Negative margin (-$${(pay - rev).toFixed(0)})`);
      // Very low conversion with decent volume
      if (convRate < 5 && convRate > 0 && arr.length >= 15) reasons.push(`<5% conv rate (${convRate.toFixed(1)}%)`);
      // High duplicate rate
      if (dupRate > 30 && arr.length >= 10) reasons.push(`${dupRate.toFixed(0)}% duplicate callers`);

      if (reasons.length > 0) {
        deadweight.push({ name, reason: reasons.join(' | '), calls: arr.length, rev, pay, convRate, dupRate });
      }
    }

    if (deadweight.length === 0) {
      await this.helpers.send(chatId, '✅ No deadweight vendors found this week! All vendors are performing.');
      return;
    }

    deadweight.sort((a, b) => (a.rev - a.pay) - (b.rev - b.pay)); // worst margin first

    let totalWaste = 0;
    let msg = `💀 <b>DEADWEIGHT VENDORS</b> (Past Week)\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;

    for (const d of deadweight) {
      const profit = d.rev - d.pay;
      totalWaste += Math.min(profit, 0);
      msg += `🔴 <b>${this.helpers.esc(d.name)}</b>\n`;
      msg += `   📞 ${d.calls} calls | Conv: ${d.convRate.toFixed(1)}% | 🔄 ${d.dupRate.toFixed(0)}% dups\n`;
      msg += `   💰 Rev: $${d.rev.toFixed(0)} | Pay: $${d.pay.toFixed(0)} | P/L: $${profit.toFixed(0)}\n`;
      msg += `   ⚠️ ${d.reason}\n\n`;
    }

    msg += `\n<b>💸 Total money lost: $${Math.abs(totalWaste).toFixed(0)}</b>\n`;
    msg += `<b>🎯 Action:</b> /pause [vendor name] to stop bleeding`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 5. MARGINS ====================
  async handleMargins(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange('week');
    await this.helpers.send(chatId, `⏳ Analyzing margins (past week)...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);

    if (args) {
      // Check if it's an offer or vendor name
      const filteredByOffer = calls.filter(c => (c.offer || '').toLowerCase().includes(args.toLowerCase()));
      const filteredByVendor = calls.filter(c => (c.traffic_source || '').toLowerCase().includes(args.toLowerCase()));

      if (filteredByOffer.length > filteredByVendor.length) {
        return this.showMarginsByVendor(chatId, filteredByOffer, args, 'offer');
      } else if (filteredByVendor.length > 0) {
        return this.showMarginsByOffer(chatId, filteredByVendor, args, 'vendor');
      }
    }

    // Default: show both offer and vendor margins
    const byOffer = this.helpers.groupBy(calls, 'offer');
    const offerMargins = Object.entries(byOffer)
      .map(([name, oc]) => {
        const arr = oc as any[];
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
        return { name, rev, pay, profit: rev - pay, margin: rev > 0 ? ((rev - pay) / rev * 100) : 0, calls: arr.length };
      })
      .sort((a, b) => b.profit - a.profit);

    let msg = `📊 <b>PROFIT MARGINS</b> (Past Week)\n\n`;
    msg += `<b>📋 By Campaign</b>\n`;
    for (const o of offerMargins) {
      const emoji = o.margin >= 20 ? '🟢' : o.margin >= 10 ? '🟡' : '🔴';
      msg += `${emoji} ${this.helpers.esc(o.name)}\n`;
      msg += `   Rev: $${o.rev.toFixed(0)} | Pay: $${o.pay.toFixed(0)} | Profit: <b>$${o.profit.toFixed(0)}</b> (${o.margin.toFixed(0)}%)\n\n`;
    }

    // Top vendor margins
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');
    const vendorMargins = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
        return { name, rev, pay, profit: rev - pay, margin: rev > 0 ? ((rev - pay) / rev * 100) : 0, calls: arr.length };
      })
      .filter(v => v.calls >= 5)
      .sort((a, b) => b.margin - a.margin);

    msg += `\n<b>👤 Best Margin Vendors</b> (5+ calls)\n`;
    for (const v of vendorMargins.slice(0, 5)) {
      msg += `  🟢 ${this.helpers.esc(v.name)}: ${v.margin.toFixed(0)}% margin | $${v.profit.toFixed(0)} profit\n`;
    }

    msg += `\n<b>👤 Worst Margin Vendors</b>\n`;
    for (const v of vendorMargins.slice(-5).reverse()) {
      const emoji = v.margin < 0 ? '🔴' : '🟡';
      msg += `  ${emoji} ${this.helpers.esc(v.name)}: ${v.margin.toFixed(0)}% margin | $${v.profit.toFixed(0)} profit\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  private async showMarginsByVendor(chatId: string, calls: any[], filterName: string, filterType: string): Promise<void> {
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');
    const margins = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
        return { name, rev, pay, profit: rev - pay, margin: rev > 0 ? ((rev - pay) / rev * 100) : 0, calls: arr.length };
      })
      .sort((a, b) => b.margin - a.margin);

    let msg = `📊 <b>MARGINS — ${filterName.toUpperCase()}</b> (By Vendor)\n\n`;
    for (const m of margins) {
      const emoji = m.margin >= 20 ? '🟢' : m.margin >= 10 ? '🟡' : '🔴';
      msg += `${emoji} ${this.helpers.esc(m.name)}\n`;
      msg += `   ${m.calls} calls | Rev: $${m.rev.toFixed(0)} | Pay: $${m.pay.toFixed(0)} | Profit: $${m.profit.toFixed(0)} (${m.margin.toFixed(0)}%)\n\n`;
    }
    await this.helpers.send(chatId, msg);
  }

  private async showMarginsByOffer(chatId: string, calls: any[], filterName: string, filterType: string): Promise<void> {
    const byOffer = this.helpers.groupBy(calls, 'offer');
    const margins = Object.entries(byOffer)
      .map(([name, oc]) => {
        const arr = oc as any[];
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
        return { name, rev, pay, profit: rev - pay, margin: rev > 0 ? ((rev - pay) / rev * 100) : 0, calls: arr.length };
      })
      .sort((a, b) => b.margin - a.margin);

    let msg = `📊 <b>MARGINS — ${filterName.toUpperCase()}</b> (By Campaign)\n\n`;
    for (const m of margins) {
      const emoji = m.margin >= 20 ? '🟢' : m.margin >= 10 ? '🟡' : '🔴';
      msg += `${emoji} ${this.helpers.esc(m.name)}\n`;
      msg += `   ${m.calls} calls | Rev: $${m.rev.toFixed(0)} | Pay: $${m.pay.toFixed(0)} | Profit: $${m.profit.toFixed(0)} (${m.margin.toFixed(0)}%)\n\n`;
    }
    await this.helpers.send(chatId, msg);
  }

  // ==================== 6. GEO ====================
  async handleGeo(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange('week');
    await this.helpers.send(chatId, `⏳ Analyzing geographic performance (past week)...`);

    let calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    if (args) {
      calls = calls.filter(c => (c.offer || '').toLowerCase().includes(args.toLowerCase()));
    }

    const byState: Record<string, any[]> = {};
    for (const c of calls) {
      const state = c['token-state'] || c['token-geo_state']?.replace('us-', '').toUpperCase() || 'UNKNOWN';
      if (!byState[state]) byState[state] = [];
      byState[state].push(c);
    }

    const stateStats = Object.entries(byState)
      .filter(([state]) => state !== 'UNKNOWN')
      .map(([state, sc]) => {
        const rev = sc.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
        const pay = sc.reduce((s, c) => s + (Number(c.payout) || 0), 0);
        const conv = sc.filter(c => c.buyer_converted === 'Converted').length;
        const convRate = sc.length > 0 ? (conv / sc.length) * 100 : 0;
        return { state, calls: sc.length, rev, pay, profit: rev - pay, conv, convRate };
      })
      .sort((a, b) => b.rev - a.rev);

    const offerLabel = args ? ` — ${args.toUpperCase()}` : '';
    let msg = `🌍 <b>GEO PERFORMANCE${offerLabel}</b> (Past Week)\n\n`;

    // Top revenue states
    msg += `<b>💰 Top Revenue States</b>\n`;
    for (const s of stateStats.slice(0, 10)) {
      const emoji = s.convRate >= 20 ? '🟢' : s.convRate >= 10 ? '🟡' : '🔴';
      msg += `  ${emoji} <b>${s.state}</b>: ${s.calls} calls | ${s.conv} conv (${s.convRate.toFixed(0)}%) | $${s.rev.toFixed(0)} rev | $${s.profit.toFixed(0)} profit\n`;
    }

    // Best conversion states (min 5 calls)
    const bestConv = [...stateStats].filter(s => s.calls >= 5).sort((a, b) => b.convRate - a.convRate);
    msg += `\n<b>✅ Best Converting States</b> (5+ calls)\n`;
    for (const s of bestConv.slice(0, 5)) {
      msg += `  🟢 <b>${s.state}</b>: ${s.convRate.toFixed(0)}% conv | ${s.calls} calls | $${s.rev.toFixed(0)}\n`;
    }

    // Worst conversion states (min 5 calls)
    msg += `\n<b>❌ Worst Converting States</b> (5+ calls)\n`;
    for (const s of bestConv.slice(-5).reverse()) {
      msg += `  🔴 <b>${s.state}</b>: ${s.convRate.toFixed(0)}% conv | ${s.calls} calls | $${s.rev.toFixed(0)}\n`;
    }

    msg += `\n📊 ${stateStats.length} states tracked | ${stateStats.reduce((s, st) => s + st.calls, 0)} total calls`;
    await this.helpers.send(chatId, msg);
  }

  // ==================== 7. GROWTH ====================
  async handleGrowth(chatId: string, args: string): Promise<void> {
    const period = args?.toLowerCase() === 'month' ? 'month' : 'week';
    await this.helpers.send(chatId, `⏳ Calculating growth trends...`);

    const now = new Date();
    const pst = new Date(now.getTime() - 7 * 60 * 60 * 1000);

    let currentFrom: string, currentTo: string, prevFrom: string, prevTo: string, label: string;

    if (period === 'month') {
      const cur = new Date(pst); cur.setDate(cur.getDate() - 30);
      const prev = new Date(pst); prev.setDate(prev.getDate() - 60);
      currentFrom = cur.toISOString().split('T')[0];
      currentTo = new Date(pst.getTime() + 86400000).toISOString().split('T')[0];
      prevFrom = prev.toISOString().split('T')[0];
      prevTo = currentFrom;
      label = '30-Day';
    } else {
      const cur = new Date(pst); cur.setDate(cur.getDate() - 7);
      const prev = new Date(pst); prev.setDate(prev.getDate() - 14);
      currentFrom = cur.toISOString().split('T')[0];
      currentTo = new Date(pst.getTime() + 86400000).toISOString().split('T')[0];
      prevFrom = prev.toISOString().split('T')[0];
      prevTo = currentFrom;
      label = 'Weekly';
    }

    const [currentCalls, prevCalls] = await Promise.all([
      this.td.fetchAllCallsForRange(currentFrom, currentTo),
      this.td.fetchAllCallsForRange(prevFrom, prevTo),
    ]);

    const calc = (calls: any[]) => {
      const rev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const pay = calls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
      const conv = calls.filter(c => c.buyer_converted === 'Converted').length;
      const convRate = calls.length > 0 ? (conv / calls.length) * 100 : 0;
      return { total: calls.length, rev, pay, profit: rev - pay, conv, convRate };
    };

    const cur = calc(currentCalls);
    const prev = calc(prevCalls);

    const pctChange = (a: number, b: number) => {
      if (b === 0) return a > 0 ? '+∞' : '0';
      const pct = ((a - b) / b * 100);
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    };
    const arrow = (a: number, b: number) => a > b ? '📈' : a < b ? '📉' : '➡️';

    // Per-offer growth
    const curByOffer = this.helpers.groupBy(currentCalls, 'offer');
    const prevByOffer = this.helpers.groupBy(prevCalls, 'offer');
    const allOffers = new Set([...Object.keys(curByOffer), ...Object.keys(prevByOffer)]);
    let offerGrowth = '';
    for (const offerName of allOffers) {
      const cArr = (curByOffer[offerName] || []) as any[];
      const pArr = (prevByOffer[offerName] || []) as any[];
      const cRev = cArr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const pRev = pArr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      offerGrowth += `  ${arrow(cRev, pRev)} ${this.helpers.esc(offerName)}: $${cRev.toFixed(0)} (${pctChange(cRev, pRev)})\n`;
    }

    const msg = `📈 <b>${label.toUpperCase()} GROWTH REPORT</b>\n\n` +
      `<b>This Period vs Previous</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `${arrow(cur.rev, prev.rev)} Revenue: <b>$${cur.rev.toFixed(0)}</b> vs $${prev.rev.toFixed(0)} (${pctChange(cur.rev, prev.rev)})\n` +
      `${arrow(cur.profit, prev.profit)} Profit: <b>$${cur.profit.toFixed(0)}</b> vs $${prev.profit.toFixed(0)} (${pctChange(cur.profit, prev.profit)})\n` +
      `${arrow(cur.total, prev.total)} Calls: <b>${cur.total}</b> vs ${prev.total} (${pctChange(cur.total, prev.total)})\n` +
      `${arrow(cur.conv, prev.conv)} Conversions: <b>${cur.conv}</b> vs ${prev.conv} (${pctChange(cur.conv, prev.conv)})\n` +
      `${arrow(cur.convRate, prev.convRate)} Conv Rate: <b>${cur.convRate.toFixed(1)}%</b> vs ${prev.convRate.toFixed(1)}%\n\n` +
      `<b>📋 Revenue by Campaign</b>\n${offerGrowth}`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 8. LEADERBOARD ====================
  async handleLeaderboard(chatId: string): Promise<void> {
    const range = this.helpers.parseRange('week');
    await this.helpers.send(chatId, `⏳ Building vendor leaderboard (past week)...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');

    const vendorRanks = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const pay = arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
        const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
        return { name, calls: arr.length, rev, pay, profit: rev - pay, conv, convRate: arr.length > 0 ? (conv / arr.length * 100) : 0 };
      })
      .sort((a, b) => b.profit - a.profit);

    let msg = `🏆 <b>VENDOR LEADERBOARD</b> (Past Week)\n\n`;

    // Top 10
    msg += `<b>🥇 TOP PERFORMERS</b>\n`;
    const medals = ['🥇', '🥈', '🥉'];
    for (let i = 0; i < Math.min(vendorRanks.length, 10); i++) {
      const v = vendorRanks[i];
      const medal = i < 3 ? medals[i] : `  ${i + 1}.`;
      msg += `${medal} <b>${this.helpers.esc(v.name)}</b>\n`;
      msg += `     ${v.calls} calls | ${v.conv} conv (${v.convRate.toFixed(0)}%) | Profit: <b>$${v.profit.toFixed(0)}</b>\n\n`;
    }

    // Bottom 5
    if (vendorRanks.length > 10) {
      msg += `\n<b>⚠️ BOTTOM PERFORMERS</b>\n`;
      const bottom = vendorRanks.slice(-5).reverse();
      for (const v of bottom) {
        const emoji = v.profit < 0 ? '🔴' : '🟡';
        msg += `${emoji} ${this.helpers.esc(v.name)}: ${v.calls} calls | ${v.convRate.toFixed(0)}% conv | $${v.profit.toFixed(0)} profit\n`;
      }
    }

    const totalProfit = vendorRanks.reduce((s, v) => s + v.profit, 0);
    msg += `\n━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 ${vendorRanks.length} vendors | Total Profit: <b>$${totalProfit.toFixed(0)}</b>`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 9. CAPACITY ====================
  async handleCapacity(chatId: string): Promise<void> {
    await this.helpers.send(chatId, '⏳ Analyzing buyer capacity...');

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const weekRange = this.helpers.parseRange('week');

    const [todayCalls, weekCalls] = await Promise.all([
      this.td.fetchAllCallsForRange(today, tomorrow),
      this.td.fetchAllCallsForRange(weekRange.from, weekRange.to),
    ]);

    // Weekly average per buyer
    const weekByBuyer = this.helpers.groupBy(weekCalls.filter(c => c.buyer), 'buyer');
    const todayByBuyer = this.helpers.groupBy(todayCalls.filter(c => c.buyer), 'buyer');

    const buyerCap = Object.entries(weekByBuyer)
      .map(([name, wc]) => {
        const weekArr = wc as any[];
        const todayArr = (todayByBuyer[name] || []) as any[];
        const avgDaily = weekArr.length / 7;
        const todayCount = todayArr.length;
        const utilization = avgDaily > 0 ? (todayCount / avgDaily) * 100 : 0;
        const todayRev = todayArr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
        const todayConv = todayArr.filter((c: any) => c.buyer_converted === 'Converted').length;
        return { name, todayCount, avgDaily, utilization, todayRev, todayConv, weekTotal: weekArr.length };
      })
      .sort((a, b) => b.utilization - a.utilization);

    let msg = `📊 <b>BUYER CAPACITY MONITOR</b>\n\n`;

    // Near/over capacity
    const overCap = buyerCap.filter(b => b.utilization >= 80);
    const underCap = buyerCap.filter(b => b.utilization < 50 && b.avgDaily >= 2);

    if (overCap.length > 0) {
      msg += `<b>🔴 Near/Over Capacity</b>\n`;
      for (const b of overCap) {
        const emoji = b.utilization >= 100 ? '🔴' : '🟠';
        msg += `${emoji} <b>${this.helpers.esc(b.name)}</b>\n`;
        msg += `   Today: ${b.todayCount} calls (avg ${b.avgDaily.toFixed(0)}/day) — <b>${b.utilization.toFixed(0)}% utilized</b>\n`;
        msg += `   💰 $${b.todayRev.toFixed(0)} rev | ${b.todayConv} conv\n\n`;
      }
    }

    if (underCap.length > 0) {
      msg += `<b>🟢 Room for More Traffic</b>\n`;
      for (const b of underCap) {
        msg += `🟢 <b>${this.helpers.esc(b.name)}</b>\n`;
        msg += `   Today: ${b.todayCount} calls (avg ${b.avgDaily.toFixed(0)}/day) — ${b.utilization.toFixed(0)}% utilized\n\n`;
      }
    }

    // Normal
    const normal = buyerCap.filter(b => b.utilization >= 50 && b.utilization < 80);
    if (normal.length > 0) {
      msg += `<b>🔵 Normal Range</b>\n`;
      for (const b of normal) {
        msg += `🔵 ${this.helpers.esc(b.name)}: ${b.todayCount}/${b.avgDaily.toFixed(0)} (${b.utilization.toFixed(0)}%)\n`;
      }
    }

    msg += `\n━━━━━━━━━━━━━━━━━━\n`;
    msg += `${overCap.length} at capacity | ${underCap.length} have room | ${normal.length} normal`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 10. WEEKLY BRIEF (built here, triggered by cron/command) ====================
  async buildWeeklyBrief(): Promise<string> {
    const curRange = this.helpers.parseRange('week');
    const now = new Date();
    const pst = new Date(now.getTime() - 7 * 60 * 60 * 1000);
    const prevStart = new Date(pst); prevStart.setDate(prevStart.getDate() - 14);
    const prevEnd = new Date(pst); prevEnd.setDate(prevEnd.getDate() - 7);

    const [curCalls, prevCalls] = await Promise.all([
      this.td.fetchAllCallsForRange(curRange.from, curRange.to),
      this.td.fetchAllCallsForRange(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]),
    ]);

    const calc = (calls: any[]) => {
      const rev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const pay = calls.reduce((s, c) => s + (Number(c.payout) || 0), 0);
      const conv = calls.filter(c => c.buyer_converted === 'Converted').length;
      return { total: calls.length, rev, pay, profit: rev - pay, conv, convRate: calls.length > 0 ? (conv / calls.length * 100) : 0 };
    };

    const cur = calc(curCalls);
    const prev = calc(prevCalls);
    const pctChange = (a: number, b: number) => b === 0 ? (a > 0 ? '+∞' : '0%') : `${((a - b) / b * 100) >= 0 ? '+' : ''}${((a - b) / b * 100).toFixed(0)}%`;

    // Top 3 vendors
    const byVendor = this.helpers.groupBy(curCalls, 'traffic_source');
    const vendorStats = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        const profit = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0) - arr.reduce((s: number, c: any) => s + (Number(c.payout) || 0), 0);
        const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
        return { name, calls: arr.length, profit, conv, convRate: arr.length > 0 ? (conv / arr.length * 100) : 0 };
      });

    const topVendors = [...vendorStats].sort((a, b) => b.profit - a.profit).slice(0, 3);
    const bottomVendors = [...vendorStats].filter(v => v.calls >= 5).sort((a, b) => a.convRate - b.convRate).slice(0, 3);

    // Buyer answer rates
    const byBuyer = this.helpers.groupBy(curCalls.filter(c => c.buyer), 'buyer');
    const worstBuyers = Object.entries(byBuyer)
      .map(([name, bc]) => {
        const arr = bc as any[];
        const noAns = arr.filter((c: any) => (c.total_duration || 0) < 10).length;
        return { name, noAnsRate: arr.length > 0 ? (noAns / arr.length * 100) : 0, calls: arr.length };
      })
      .filter(b => b.noAnsRate > 20 && b.calls >= 5)
      .sort((a, b) => b.noAnsRate - a.noAnsRate);

    let topLines = '';
    for (const v of topVendors) {
      topLines += `  ⭐ ${this.helpers.esc(v.name)}: $${v.profit.toFixed(0)} profit | ${v.convRate.toFixed(0)}% conv\n`;
    }
    let bottomLines = '';
    for (const v of bottomVendors) {
      bottomLines += `  ⚠️ ${this.helpers.esc(v.name)}: ${v.convRate.toFixed(0)}% conv | ${v.calls} calls\n`;
    }
    let buyerLines = '';
    for (const b of worstBuyers.slice(0, 3)) {
      buyerLines += `  📵 ${this.helpers.esc(b.name)}: ${b.noAnsRate.toFixed(0)}% no-answer rate\n`;
    }

    // Recommendations
    const recs: string[] = [];
    for (const v of bottomVendors) {
      if (v.convRate < 5) recs.push(`⏸️ Consider pausing ${v.name} (${v.convRate.toFixed(0)}% conv)`);
    }
    for (const v of topVendors) {
      if (v.profit > 100) recs.push(`📈 Scale ${v.name} — $${v.profit.toFixed(0)} profit this week`);
    }
    for (const b of worstBuyers) {
      recs.push(`📞 Contact ${b.name} — ${b.noAnsRate.toFixed(0)}% unanswered calls`);
    }

    return `📋 <b>WEEKLY STRATEGY BRIEF</b>\n` +
      `📅 ${curRange.from} → ${curRange.to}\n\n` +
      `<b>📊 Week Summary</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💰 Revenue: <b>$${cur.rev.toFixed(0)}</b> (${pctChange(cur.rev, prev.rev)} vs last week)\n` +
      `📈 Profit: <b>$${cur.profit.toFixed(0)}</b> (${pctChange(cur.profit, prev.profit)})\n` +
      `📞 Calls: <b>${cur.total}</b> (${pctChange(cur.total, prev.total)})\n` +
      `✅ Conv Rate: <b>${cur.convRate.toFixed(1)}%</b> (was ${prev.convRate.toFixed(1)}%)\n\n` +
      `<b>⭐ Top 3 Vendors</b>\n${topLines}\n` +
      `<b>⚠️ Bottom 3 Vendors</b>\n${bottomLines}\n` +
      (buyerLines ? `<b>📵 Buyer Answer Rate Issues</b>\n${buyerLines}\n` : '') +
      `<b>🎯 Recommended Actions</b>\n${recs.map(r => `  ${r}`).join('\n') || '  ✅ No urgent actions needed'}\n`;
  }

  // ==================== 11. DUPLICATES ====================
  async handleDuplicates(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange(args || 'today');
    await this.helpers.send(chatId, `⏳ Scanning for duplicate callers (${range.label})...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);

    // Group by caller number
    const byNumber: Record<string, any[]> = {};
    for (const c of calls) {
      const num = c.caller_number || c.caller_id;
      if (!num) continue;
      if (!byNumber[num]) byNumber[num] = [];
      byNumber[num].push(c);
    }

    const duplicates = Object.entries(byNumber)
      .filter(([, arr]) => arr.length > 1)
      .map(([number, arr]) => {
        const vendors = [...new Set(arr.map(c => c.traffic_source || 'Unknown'))];
        const pay = arr.reduce((s, c) => s + (Number(c.payout) || 0), 0);
        const rev = arr.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
        return { number, count: arr.length, vendors, pay, rev, waste: pay - rev };
      })
      .sort((a, b) => b.count - a.count);

    const totalDups = duplicates.reduce((s, d) => s + d.count - 1, 0); // extra calls
    const totalWaste = duplicates.reduce((s, d) => s + Math.max(d.waste, 0), 0);

    let msg = `🔄 <b>DUPLICATE CALLERS — ${range.label.toUpperCase()}</b>\n\n`;
    msg += `📊 <b>${duplicates.length}</b> numbers called multiple times\n`;
    msg += `📞 <b>${totalDups}</b> extra duplicate calls\n`;
    msg += `💸 Est. wasted spend: <b>$${totalWaste.toFixed(0)}</b>\n\n`;

    // Worst offenders - cross-vendor dups
    const crossVendor = duplicates.filter(d => d.vendors.length > 1);
    if (crossVendor.length > 0) {
      msg += `<b>⚠️ Cross-Vendor Duplicates</b> (same # from different vendors)\n`;
      for (const d of crossVendor.slice(0, 10)) {
        msg += `  📞 ${d.number}: ${d.count}x from ${d.vendors.map(v => this.helpers.esc(v)).join(', ')}\n`;
      }
      msg += `\n`;
    }

    // Vendor duplicate rates
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');
    const vendorDupRates = Object.entries(byVendor)
      .map(([name, vc]) => {
        const arr = vc as any[];
        const numbers = arr.map(c => c.caller_number || c.caller_id).filter(Boolean);
        const unique = new Set(numbers).size;
        const dupRate = numbers.length > 0 ? ((numbers.length - unique) / numbers.length) * 100 : 0;
        return { name, total: numbers.length, unique, dupRate };
      })
      .filter(v => v.dupRate > 0 && v.total >= 5)
      .sort((a, b) => b.dupRate - a.dupRate);

    if (vendorDupRates.length > 0) {
      msg += `<b>👤 Vendors with Highest Duplicate Rates</b>\n`;
      for (const v of vendorDupRates.slice(0, 10)) {
        const emoji = v.dupRate >= 30 ? '🔴' : v.dupRate >= 15 ? '🟡' : '🔵';
        msg += `  ${emoji} ${this.helpers.esc(v.name)}: ${v.dupRate.toFixed(0)}% dups (${v.total - v.unique}/${v.total})\n`;
      }
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== 12. HOURLY PACE ====================
  async handleHourlyPace(chatId: string): Promise<void> {
    await this.helpers.send(chatId, '⏳ Building hourly pace report...');

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const calls = await this.td.fetchAllCallsForRange(today, tomorrow);

    // Group by hour (PST)
    const byHour: Record<number, any[]> = {};
    for (const c of calls) {
      const created = new Date(c.created_at);
      const pstHour = (created.getUTCHours() - 7 + 24) % 24;
      if (!byHour[pstHour]) byHour[pstHour] = [];
      byHour[pstHour].push(c);
    }

    const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const totalConv = calls.filter(c => c.buyer_converted === 'Converted').length;
    const now = new Date();
    const currentPstHour = (now.getUTCHours() - 7 + 24) % 24;

    // Goal check
    const goalSetting = await this.prisma.bot_setting.findUnique({ where: { key: 'daily_goal' } });
    const goalAmt = goalSetting ? parseFloat(goalSetting.value) : 0;

    // Business hours projection (7am - 7pm)
    const bizStart = 7;
    const bizEnd = 19;
    const hoursElapsed = Math.max(currentPstHour - bizStart, 0.5);
    const hourlyRate = totalRev / hoursElapsed;
    const projected = hourlyRate * (bizEnd - bizStart);

    let msg = `⏰ <b>HOURLY PACE — TODAY</b>\n\n`;
    msg += `💰 Total: <b>$${totalRev.toFixed(0)}</b> | 📞 ${calls.length} calls | ✅ ${totalConv} conv\n`;
    msg += `📊 Projected EOD: <b>$${projected.toFixed(0)}</b> ($${hourlyRate.toFixed(0)}/hr)\n`;
    if (goalAmt > 0) {
      msg += `🎯 Goal: $${goalAmt.toFixed(0)} — ${projected >= goalAmt ? '✅ On pace' : '⚠️ Behind pace'}\n`;
    }
    msg += `\n<b>Hour-by-Hour</b>\n`;

    // Find the peak hour for the bar chart scaling
    const maxHourRev = Math.max(...Object.values(byHour).map(hc => hc.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0)), 1);

    for (let h = bizStart; h <= Math.min(currentPstHour, bizEnd); h++) {
      const hCalls = byHour[h] || [];
      const hRev = hCalls.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const hConv = hCalls.filter((c: any) => c.buyer_converted === 'Converted').length;
      const bar = this.helpers.miniBar(hRev, maxHourRev, 8);
      const timeLabel = `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`;
      const pointer = h === currentPstHour ? ' ◀️ NOW' : '';
      msg += `  ${timeLabel.padStart(4)}: ${bar} $${hRev.toFixed(0)} (${hCalls.length}c/${hConv}cv)${pointer}\n`;
    }

    // Peak hour
    let peakHour = bizStart;
    let peakRev = 0;
    for (const [h, hCalls] of Object.entries(byHour)) {
      const hRev = (hCalls as any[]).reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      if (hRev > peakRev) { peakRev = hRev; peakHour = parseInt(h); }
    }
    msg += `\n🔥 Peak: ${peakHour > 12 ? peakHour - 12 : peakHour}${peakHour >= 12 ? 'pm' : 'am'} ($${peakRev.toFixed(0)})`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== 13. AUTOPAUSE ====================
  async handleAutopause(chatId: string, args: string): Promise<void> {
    const action = args?.toLowerCase();

    if (action === 'on') {
      await this.prisma.bot_setting.upsert({
        where: { key: 'autopause_enabled' },
        create: { key: 'autopause_enabled', value: 'true' },
        update: { value: 'true' },
      });
      await this.helpers.send(chatId,
        `✅ <b>Auto-Pause ENABLED</b>\n\n` +
        `Rules:\n` +
        `  🔴 0% conv rate after 15+ calls → Auto pause\n` +
        `  🟠 <5% conv rate after 25+ calls → Auto pause\n` +
        `  🟡 >30% duplicate callers (15+ calls) → Auto pause\n` +
        `  🔴 3+ QA flags from same vendor → Auto pause\n\n` +
        `Checked every 30 minutes. You'll be notified of any actions.`);
      return;
    }

    if (action === 'off') {
      await this.prisma.bot_setting.upsert({
        where: { key: 'autopause_enabled' },
        create: { key: 'autopause_enabled', value: 'false' },
        update: { value: 'false' },
      });
      await this.helpers.send(chatId, '⏸️ Auto-Pause <b>DISABLED</b>');
      return;
    }

    // Status
    const enabled = await this.prisma.bot_setting.findUnique({ where: { key: 'autopause_enabled' } });
    const isEnabled = enabled?.value === 'true';

    const recentLogs = await this.prisma.autopause_log.findMany({
      take: 10,
      orderBy: { paused_at: 'desc' },
    });

    let msg = `🤖 <b>AUTO-PAUSE STATUS</b>\n\n`;
    msg += `Status: ${isEnabled ? '✅ <b>ENABLED</b>' : '⏸️ <b>DISABLED</b>'}\n\n`;
    msg += `<b>Rules</b>\n`;
    msg += `  🔴 0% conv after 15+ calls\n`;
    msg += `  🟠 <5% conv after 25+ calls\n`;
    msg += `  🟡 >30% dups (15+ calls)\n`;
    msg += `  🔴 3+ QA flags\n\n`;

    if (recentLogs.length > 0) {
      msg += `<b>Recent Auto-Pauses</b>\n`;
      for (const log of recentLogs) {
        msg += `  ⏸️ ${this.helpers.esc(log.vendor_name)} — ${log.reason}\n`;
        msg += `     ${this.helpers.fmtDate(log.paused_at)}\n`;
      }
    } else {
      msg += `No auto-pauses recorded yet.`;
    }

    msg += `\n\n/autopause on — Enable\n/autopause off — Disable`;
    await this.helpers.send(chatId, msg);
  }

  // This runs from the cron endpoint
  async runAutopauseCheck(): Promise<string[]> {
    const enabled = await this.prisma.bot_setting.findUnique({ where: { key: 'autopause_enabled' } });
    if (enabled?.value !== 'true') return [];

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const calls = await this.td.fetchAllCallsForRange(today, tomorrow);
    const byVendor = this.helpers.groupBy(calls, 'traffic_source');
    const actions: string[] = [];

    // Get active traffic sources to check pause status
    const tsData = await this.td.listTrafficSources({ per_page: 100 });
    const allTS = tsData?.traffic_sources || [];
    const activeTS = new Map<string, any>(allTS.filter((ts: any) => !ts.paused).map((ts: any) => [ts.name, ts]));

    for (const [name, vc] of Object.entries(byVendor)) {
      const arr = vc as any[];
      const ts = activeTS.get(name);
      if (!ts) continue; // already paused

      const conv = arr.filter((c: any) => c.buyer_converted === 'Converted').length;
      const convRate = arr.length > 0 ? (conv / arr.length) * 100 : 0;

      // Duplicate rate
      const callerNumbers = arr.map((c: any) => c.caller_number).filter(Boolean);
      const uniqueCallers = new Set(callerNumbers).size;
      const dupRate = callerNumbers.length > 0 ? ((callerNumbers.length - uniqueCallers) / callerNumbers.length) * 100 : 0;

      let reason = '';
      if (convRate === 0 && arr.length >= 15) reason = `0% conversion (${arr.length} calls)`;
      else if (convRate < 5 && arr.length >= 25) reason = `${convRate.toFixed(1)}% conv (${arr.length} calls)`;
      else if (dupRate > 30 && arr.length >= 15) reason = `${dupRate.toFixed(0)}% duplicates (${arr.length} calls)`;

      if (reason) {
        try {
          await this.td.pauseTrafficSource(String(ts.id), true);
          await this.prisma.autopause_log.create({
            data: { vendor_id: String(ts.id), vendor_name: name, reason, calls: arr.length, conversion_rate: convRate },
          });
          actions.push(`⏸️ Auto-paused <b>${this.helpers.esc(name)}</b> — ${reason}`);
        } catch (err: any) {
          this.logger.error(`Autopause failed for ${name}: ${err.message}`);
        }
      }
    }

    // Check QA flags
    const todayFlags = await this.prisma.flag.groupBy({
      by: ['affiliate_id'],
      where: { created_at: { gte: new Date(today) } },
      _count: { id: true },
      having: { id: { _count: { gte: 3 } } },
    });

    for (const fg of todayFlags) {
      if (!fg.affiliate_id) continue;
      const affiliate = await this.prisma.affiliate.findUnique({ where: { id: fg.affiliate_id } });
      if (!affiliate) continue;
      const ts = activeTS.get(affiliate.name);
      if (!ts) continue;

      const reason = `${fg._count.id} QA flags today`;
      try {
        await this.td.pauseTrafficSource(String(ts.id), true);
        await this.prisma.autopause_log.create({
          data: { vendor_id: String(ts.id), vendor_name: affiliate.name, reason, calls: 0, conversion_rate: 0 },
        });
        actions.push(`⏸️ Auto-paused <b>${this.helpers.esc(affiliate.name)}</b> — ${reason}`);
      } catch (err: any) {
        this.logger.error(`Autopause QA failed for ${affiliate.name}: ${err.message}`);
      }
    }

    return actions;
  }

  // ==================== 14. GAPS ====================
  async handleGaps(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange('week');
    await this.helpers.send(chatId, `⏳ Analyzing geographic coverage gaps...`);

    let calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    if (args) {
      calls = calls.filter(c => (c.offer || '').toLowerCase().includes(args.toLowerCase()));
    }

    // All US states
    const allStates = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

    const byState: Record<string, any[]> = {};
    for (const c of calls) {
      const state = (c['token-state'] || c['token-geo_state']?.replace('us-', '') || '').toUpperCase();
      if (!state || state === 'UNKNOWN') continue;
      if (!byState[state]) byState[state] = [];
      byState[state].push(c);
    }

    // Calculate per state
    const stateData = allStates.map(state => {
      const sc = byState[state] || [];
      const rev = sc.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const conv = sc.filter(c => c.buyer_converted === 'Converted').length;
      const convRate = sc.length > 0 ? (conv / sc.length) * 100 : 0;
      return { state, calls: sc.length, rev, conv, convRate };
    });

    // High-converting, low-volume = opportunity
    const opportunities = stateData
      .filter(s => s.convRate >= 15 && s.calls >= 3 && s.calls < 20)
      .sort((a, b) => b.convRate - a.convRate);

    // Zero coverage
    const noCoverage = stateData.filter(s => s.calls === 0);

    // High volume, low conversion = problem
    const problems = stateData
      .filter(s => s.calls >= 10 && s.convRate < 5)
      .sort((a, b) => a.convRate - b.convRate);

    const offerLabel = args ? ` — ${args.toUpperCase()}` : '';
    let msg = `🗺️ <b>COVERAGE GAPS${offerLabel}</b> (Past Week)\n\n`;

    if (opportunities.length > 0) {
      msg += `<b>🟢 OPPORTUNITY — High Conv, Low Volume</b>\n`;
      msg += `<i>These states convert well but you're not sending enough traffic</i>\n\n`;
      for (const s of opportunities.slice(0, 10)) {
        msg += `  📈 <b>${s.state}</b>: ${s.convRate.toFixed(0)}% conv but only ${s.calls} calls → $${s.rev.toFixed(0)} rev\n`;
      }
      msg += `\n`;
    }

    if (noCoverage.length > 0) {
      msg += `<b>⚪ NO COVERAGE</b> (${noCoverage.length} states)\n`;
      msg += `  ${noCoverage.map(s => s.state).join(', ')}\n\n`;
    }

    if (problems.length > 0) {
      msg += `<b>🔴 PROBLEM — High Volume, Low Conv</b>\n`;
      msg += `<i>Spending money here with poor results</i>\n\n`;
      for (const s of problems.slice(0, 10)) {
        msg += `  ⚠️ <b>${s.state}</b>: ${s.calls} calls but only ${s.convRate.toFixed(0)}% conv → $${s.rev.toFixed(0)} rev\n`;
      }
    }

    msg += `\n📊 ${stateData.filter(s => s.calls > 0).length}/50 states active`;
    await this.helpers.send(chatId, msg);
  }

  // ==================== 15. ALERTS ====================
  async handleAlerts(chatId: string, args: string): Promise<void> {
    const action = args?.toLowerCase();

    if (action === 'on') {
      await this.prisma.bot_setting.upsert({
        where: { key: 'alerts_enabled' },
        create: { key: 'alerts_enabled', value: 'true' },
        update: { value: 'true' },
      });
      await this.helpers.send(chatId,
        `🔔 <b>Proactive Alerts ENABLED</b>\n\n` +
        `You'll be notified when:\n` +
        `  🔴 Buyer answer rate drops below 70%\n` +
        `  🔴 Vendor conv rate crashes (was >15%, now <5%)\n` +
        `  🟡 Daily revenue pace is 30%+ behind goal\n` +
        `  🟢 New daily revenue record\n\n` +
        `Checked every 30 minutes.`);
      return;
    }

    if (action === 'off') {
      await this.prisma.bot_setting.upsert({
        where: { key: 'alerts_enabled' },
        create: { key: 'alerts_enabled', value: 'false' },
        update: { value: 'false' },
      });
      await this.helpers.send(chatId, '🔕 Proactive Alerts <b>DISABLED</b>');
      return;
    }

    // Status
    const enabled = await this.prisma.bot_setting.findUnique({ where: { key: 'alerts_enabled' } });
    const isEnabled = enabled?.value === 'true';

    let msg = `🔔 <b>PROACTIVE ALERTS</b>\n\n`;
    msg += `Status: ${isEnabled ? '✅ <b>ENABLED</b>' : '🔕 <b>DISABLED</b>'}\n\n`;
    msg += `<b>Alert Types</b>\n`;
    msg += `  🔴 Buyer answer rate < 70%\n`;
    msg += `  🔴 Vendor conv rate crash\n`;
    msg += `  🟡 Revenue pace behind goal by 30%+\n`;
    msg += `  🟢 New daily revenue record\n\n`;
    msg += `/alerts on — Enable\n/alerts off — Disable`;

    await this.helpers.send(chatId, msg);
  }

  // ==================== CALL QUALITY ====================
  async handleCallQuality(chatId: string, args: string): Promise<void> {
    const range = this.helpers.parseRange(args || 'today');
    await this.helpers.send(chatId, `Classifying calls (${range.label})...`);

    const calls = await this.td.fetchAllCallsForRange(range.from, range.to);
    const classified = this.helpers.classifyCalls(calls);

    // Overall summary
    const total = calls.length;
    const realAnswered = (classified.converted?.length || 0) + (classified.answered?.length || 0);
    const effectiveRate = total > 0 ? (realAnswered / total * 100) : 0;
    const ivrWaste = (classified.ivr_rejected?.length || 0) + (classified.ivr_failed?.length || 0);
    const totalRev = calls.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);

    let msg = `<b>Call Quality — ${range.label}</b>\n`;
    msg += `${total} calls · $${totalRev.toFixed(0)} rev · ${effectiveRate.toFixed(0)}% real answer rate\n\n`;

    for (const cls of ['converted', 'answered', 'ivr_failed', 'ivr_rejected', 'no_answer']) {
      const arr = classified[cls] || [];
      const pct = total > 0 ? (arr.length / total * 100).toFixed(0) : '0';
      const rev = arr.reduce((s: number, c: any) => s + (Number(c.revenue) || 0), 0);
      const revStr = rev > 0 ? `  $${rev.toFixed(0)}` : '';
      msg += `  ${this.helpers.classifyLabel(cls).padEnd(14)} ${String(arr.length).padStart(3)}  (${pct}%)${revStr}\n`;
    }

    if (ivrWaste > 0) {
      msg += `\n${ivrWaste} calls never reached a human\n`;
    }

    // Per-buyer breakdown
    const byBuyer = this.helpers.groupBy(calls.filter(c => c.buyer), 'buyer');
    const buyerStats = Object.entries(byBuyer)
      .map(([name, bc]) => {
        const arr = bc as any[];
        const bc2 = this.helpers.classifyCalls(arr);
        const ans = bc2.converted.length + bc2.answered.length;
        return {
          name,
          total: arr.length,
          conv: bc2.converted.length,
          answered: bc2.answered.length,
          ivrRej: bc2.ivr_rejected.length,
          ivrFail: bc2.ivr_failed.length,
          noAns: bc2.no_answer.length,
          ansRate: arr.length > 0 ? (ans / arr.length * 100) : 0,
        };
      })
      .sort((a, b) => a.ansRate - b.ansRate);

    if (buyerStats.length > 0) {
      msg += `\n<b>By Buyer</b>\n`;
      for (const b of buyerStats) {
        const flag = b.ansRate < 60 ? ' ▼' : '';
        msg += `\n<b>${this.helpers.esc(b.name)}</b> — ${b.ansRate.toFixed(0)}% answer rate${flag}\n`;
        msg += `  ${b.conv} conv · ${b.answered} ans · ${b.ivrFail} IVR fail · ${b.ivrRej} IVR rej · ${b.noAns} no-ans\n`;
      }
    }

    // Gray zone calls (candidates for audio analysis)
    const grayZone = (classified.ivr_failed || []);
    if (grayZone.length > 0) {
      msg += `\n${grayZone.length} gray-zone calls available for audio analysis.\n`;
      msg += `Run /analyze ${args || 'today'} for details.`;
    }

    await this.helpers.send(chatId, msg);
  }

  // ==================== ANALYZE (selective audio) ====================
  async handleAnalyze(chatId: string, args: string): Promise<void> {
    if (!args) {
      await this.helpers.send(chatId, 'Usage: /analyze [today|YYYY-MM-DD|YYYY-MM-DD YYYY-MM-DD]\nExamples:\n  /analyze today\n  /analyze 2026-05-12\n  /analyze 2026-05-10 2026-05-12');
      return;
    }

    // Parse date args
    let dateFrom: string, dateTo: string, label: string;
    const dateMatch = args.match(/(\d{4}-\d{2}-\d{2})/g);

    if (dateMatch && dateMatch.length >= 2) {
      dateFrom = dateMatch[0];
      dateTo = dateMatch[1];
      // Add one day to dateTo for inclusive range
      const d = new Date(dateTo); d.setDate(d.getDate() + 1);
      dateTo = d.toISOString().split('T')[0];
      label = `${dateMatch[0]} → ${dateMatch[1]}`;
    } else if (dateMatch && dateMatch.length === 1) {
      dateFrom = dateMatch[0];
      const d = new Date(dateFrom); d.setDate(d.getDate() + 1);
      dateTo = d.toISOString().split('T')[0];
      label = dateMatch[0];
    } else {
      const range = this.helpers.parseRange(args);
      dateFrom = range.from;
      dateTo = range.to;
      label = range.label;
    }

    await this.helpers.send(chatId, `⏳ Fetching calls for ${label}...`);

    const calls = await this.td.fetchAllCallsForRange(dateFrom, dateTo);
    const classified = this.helpers.classifyCalls(calls);

    // Gray zone = IVR failed (20-60s) — these are the ones worth analyzing
    const grayZone = classified.ivr_failed || [];
    // Also include IVR rejected for full picture
    const ivrRejected = classified.ivr_rejected || [];
    const toAnalyze = [...grayZone, ...ivrRejected].filter(c => c.recording_url);

    if (toAnalyze.length === 0) {
      await this.helpers.send(chatId, `✅ No gray-zone calls with recordings found for ${label}. All calls are clearly classified.`);
      return;
    }

    // Cap at 25 to control costs
    const maxAnalyze = 25;
    const batch = toAnalyze.slice(0, maxAnalyze);

    await this.helpers.send(chatId,
      `🔍 <b>AUDIO ANALYSIS</b>\n` +
      `📅 ${label}\n\n` +
      `Found <b>${toAnalyze.length}</b> calls to analyze (${grayZone.length} IVR-failed, ${ivrRejected.length} IVR-rejected)\n` +
      `Analyzing ${batch.length}${toAnalyze.length > maxAnalyze ? ` of ${toAnalyze.length}` : ''} recordings...\n\n` +
      `⏳ This will take 1-2 minutes...`
    );

    // Process in parallel batches of 5
    const results: Array<{ call: any; classification: string; reason: string }> = [];
    const batchSize = 5;

    for (let i = 0; i < batch.length; i += batchSize) {
      const chunk = batch.slice(i, i + batchSize);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (call) => {
          try {
            const audioBuffer = await this.td.downloadRecording(call.recording_url);
            const transcript = await this.transcription.transcribeAudio(audioBuffer, `call_${call.id}.mp3`);

            // Quick LLM classification of the transcript
            const classification = await this.classifyTranscript(transcript, call);
            return { call, ...classification };
          } catch (err: any) {
            this.logger.error(`Failed to analyze call ${call.id}: ${err.message}`);
            return { call, classification: 'error', reason: `Analysis failed: ${err.message}` };
          }
        })
      );

      for (const r of chunkResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        }
      }
    }

    // Build results message
    const summary: Record<string, number> = {};
    for (const r of results) {
      summary[r.classification] = (summary[r.classification] || 0) + 1;
    }

    let msg = `🔍 <b>AUDIO ANALYSIS RESULTS</b>\n`;
    msg += `📅 ${label} | ${results.length} calls analyzed\n\n`;

    msg += `<b>Classification Summary</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    for (const [cls, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
      msg += `  ${cls}: <b>${count}</b>\n`;
    }

    // Group results by classification
    msg += `\n<b>Details</b>\n`;
    const grouped: Record<string, typeof results> = {};
    for (const r of results) {
      if (!grouped[r.classification]) grouped[r.classification] = [];
      grouped[r.classification].push(r);
    }

    for (const [cls, items] of Object.entries(grouped)) {
      msg += `\n<b>${cls}</b> (${items.length})\n`;
      for (const item of items.slice(0, 8)) {
        const c = item.call;
        const buyer = (c.buyer || 'Unknown').substring(0, 25);
        const dur = c.total_duration || 0;
        msg += `  📞 ${c.caller_number || '?'} | ${dur}s | ${this.helpers.esc(buyer)}\n`;
        msg += `     ${this.helpers.esc(item.reason.substring(0, 90))}\n`;
      }
      if (items.length > 8) {
        msg += `  ... and ${items.length - 8} more\n`;
      }
    }

    await this.helpers.send(chatId, msg);
  }

  private async classifyTranscript(transcript: string, call: any): Promise<{ classification: string; reason: string }> {
    const apiKey = process.env.ABACUSAI_API_KEY || '';

    try {
      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `You are classifying a short phone call recording from a pay-per-call marketing network. The call was routed to a buyer but was NOT converted.

Call details:
- Duration: ${call.total_duration || 0} seconds
- Buyer: ${call.buyer || 'Unknown'}
- Hangup cause: ${call.hangup_cause || 'Unknown'}

Transcript:
${transcript}

Classify this call into EXACTLY ONE of these categories and give a brief reason:

1. "IVR Rejection" — The buyer's IVR/system rejected the call (e.g., "sorry we cannot connect", "we are closed", "all agents busy", capacity full)
2. "IVR Zip Fail" — The caller failed to enter a valid zip code, or the buyer's system rejected the zip code/area
3. "IVR Cap Hit" — The buyer's system indicated they are capped/at capacity for this area or offer
4. "Caller Hung Up" — The caller hung up before connecting to an agent (during hold, IVR prompts, etc.)
5. "Short Conversation" — A brief real human conversation happened but no sale/conversion
6. "Voicemail/Closed" — Hit voicemail or business closed message
7. "Other" — Doesn't fit above categories

Respond in JSON format: {"classification": "category name", "reason": "brief explanation"}`,
          }],
          response_format: { type: 'json_object' },
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        classification: parsed.classification || 'Unknown',
        reason: parsed.reason || 'No reason provided',
      };
    } catch (err: any) {
      this.logger.error(`Transcript classification failed: ${err.message}`);
      return { classification: 'Error', reason: err.message };
    }
  }

  // Runs from cron endpoint
  async runAlertCheck(): Promise<string[]> {
    const enabled = await this.prisma.bot_setting.findUnique({ where: { key: 'alerts_enabled' } });
    if (enabled?.value !== 'true') return [];

    const today = this.helpers.todayStr();
    const tomorrow = this.helpers.tomorrowStr();
    const calls = await this.td.fetchAllCallsForRange(today, tomorrow);
    const alerts: string[] = [];

    // Buyer answer rate check
    const byBuyer = this.helpers.groupBy(calls.filter(c => c.buyer), 'buyer');
    for (const [name, bc] of Object.entries(byBuyer)) {
      const arr = bc as any[];
      if (arr.length < 10) continue;
      const answered = arr.filter((c: any) => (c.total_duration || 0) >= 10).length;
      const ansRate = (answered / arr.length) * 100;
      if (ansRate < 70) {
        alerts.push(`🔴 <b>Buyer Alert:</b> ${this.helpers.esc(name)} answer rate dropped to ${ansRate.toFixed(0)}% (${arr.length} calls)`);
      }
    }

    // Revenue pace check
    const goalSetting = await this.prisma.bot_setting.findUnique({ where: { key: 'daily_goal' } });
    if (goalSetting) {
      const goalAmt = parseFloat(goalSetting.value);
      const totalRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
      const now = new Date();
      const pstHour = (now.getUTCHours() - 7 + 24) % 24;
      if (pstHour >= 12) { // Only alert after noon
        const hoursElapsed = Math.max(pstHour - 7, 1);
        const projected = (totalRev / hoursElapsed) * 12;
        if (projected < goalAmt * 0.7) {
          alerts.push(`🟡 <b>Pace Alert:</b> Revenue projected at $${projected.toFixed(0)} — ${((projected / goalAmt) * 100).toFixed(0)}% of $${goalAmt.toFixed(0)} goal`);
        }
      }
    }

    // Revenue record check
    const todayRev = calls.reduce((s, c) => s + (Number(c.revenue) || 0), 0);
    const recordSetting = await this.prisma.bot_setting.findUnique({ where: { key: 'revenue_record' } });
    const currentRecord = recordSetting ? parseFloat(recordSetting.value) : 0;
    if (todayRev > currentRecord && todayRev > 100) {
      await this.prisma.bot_setting.upsert({
        where: { key: 'revenue_record' },
        create: { key: 'revenue_record', value: String(todayRev) },
        update: { value: String(todayRev) },
      });
      if (currentRecord > 0) {
        alerts.push(`🟢 <b>New Record!</b> $${todayRev.toFixed(0)} — beats previous $${currentRecord.toFixed(0)}`);
      }
    }

    return alerts;
  }

  // ==================== APPLICATIONS (Onboarding) ====================
  async handleApplications(chatId: string, args: string): Promise<void> {
    const status = args || 'pending';
    const validStatuses = ['pending', 'approved', 'rejected', 'all'];
    if (!validStatuses.includes(status)) {
      await this.helpers.send(chatId, `Usage: /applications [pending|approved|rejected|all]`);
      return;
    }

    const where = status === 'all' ? {} : { status };
    const apps = await this.prisma.vendor_application.findMany({
      where,
      include: { campaign: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    if (apps.length === 0) {
      await this.helpers.send(chatId, `No ${status === 'all' ? '' : status + ' '}applications found.`);
      return;
    }

    let msg = `<b>Applications</b> (${status})\n`;
    msg += `${apps.length} results\n`;

    for (const app of apps) {
      const date = new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const statusLabel = app.status === 'pending' ? 'PENDING'
        : app.status === 'approved' ? 'APPROVED'
        : app.status === 'rejected' ? 'REJECTED'
        : app.status.toUpperCase();
      msg += `\n<b>${this.helpers.esc(app.company_name)}</b>\n`;
      msg += `  ${this.helpers.esc(app.campaign.name)} · ${statusLabel} · ${date}\n`;
      msg += `  ${this.helpers.esc(app.email)} · ${this.helpers.esc(app.phone)}\n`;
    }

    await this.helpers.send(chatId, msg);
  }

  async handleRTBStats(chatId: string, args: string): Promise<void> {
    const timeLabelMap: Record<string, string> = {
      'today': 'Today',
      'yesterday': 'Yesterday',
      'week': 'This Week',
      'month': 'This Month',
      'lasthour': 'Last Hour',
      'last4h': 'Last 4 Hours',
    };
    const input = (args || 'today').toLowerCase().trim();
    const timeLabel = timeLabelMap[input] || 'Today';

    await this.helpers.send(chatId, `Pulling RTB stats for ${timeLabel}...`);

    try {
      const stats = await this.campaignMonitor.getRTBStats(timeLabel);
      // Split into chunks if needed (Telegram limit)
      const MAX = 4000;
      if (stats.length <= MAX) {
        await this.helpers.send(chatId, `<pre>${this.helpers.esc(stats)}</pre>`);
      } else {
        const lines = stats.split('\n');
        let chunk = '';
        for (const line of lines) {
          if ((chunk + '\n' + line).length > MAX) {
            await this.helpers.send(chatId, `<pre>${this.helpers.esc(chunk)}</pre>`);
            chunk = line;
          } else {
            chunk = chunk ? chunk + '\n' + line : line;
          }
        }
        if (chunk) await this.helpers.send(chatId, `<pre>${this.helpers.esc(chunk)}</pre>`);
      }
    } catch (error: any) {
      this.logger.error(`RTB stats error: ${error.message}`);
      await this.helpers.send(chatId, `Error fetching RTB stats: ${error.message}`);
    }
  }
}
