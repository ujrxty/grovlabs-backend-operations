import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';

export interface InboundPingPayload {
  trackdrive_call_id?: string;
  caller_phone?: string;
  caller_id?: string;
  caller_state?: string;
  state?: string;
  caller_zip?: string;
  zip?: string;
  caller_city?: string;
  city?: string;
  traffic_source_id?: string;
  traffic_source?: string;
  publisher?: string;
  sub_id?: string;
  subid?: string;
  offer_id?: string;
  offer?: string;
  offer_name?: string;
  [key: string]: any;
}

export interface PingStats {
  total_pings: number;
  accepted: number;
  rejected: number;
  no_bid: number;
  failed: number;
  duplicates: number;
  accept_rate: number;
  total_bid_amount: number;
  avg_bid: number;
  avg_latency_ms: number;
  unique_callers: number;
  // Conversion tracking
  calls_connected: number;
  calls_converted: number;
  conversion_rate: number;
  total_payout: number;
  avg_call_duration: number;
}

export interface SegmentStats {
  name: string;
  pings: number;
  accepted: number;
  accept_rate: number;
  total_bid: number;
  avg_bid: number;
  pct_of_total: number;
}

export interface RejectReasonBreakdown {
  reason: string;
  count: number;
  pct: number;
}

export interface TrendDataPoint {
  timestamp: string;
  pings: number;
  accepted: number;
  rejected: number;
  accept_rate: number;
  total_bid: number;
  avg_bid: number;
  duplicates: number;
}

export interface HourlyBreakdown {
  hour: number;
  day_of_week: number;
  pings: number;
  accepted: number;
  accept_rate: number;
  avg_bid: number;
}

export interface StateCoverage {
  state: string;
  pings: number;
  accepted: number;
  rejected: number;
  accept_rate: number;
  total_bid: number;
  avg_bid: number;
  coverage_score: number;
}

export interface BidAnalysis {
  total_bids: number;
  avg_bid: number;
  min_bid: number;
  max_bid: number;
  median_bid: number;
  p25_bid: number;
  p75_bid: number;
  suggested_floor: number;
  distribution: { range: string; count: number; pct: number }[];
  by_buyer: { buyer: string; avg_bid: number; win_rate: number; total_bids: number }[];
}

@Injectable()
export class PingAnalysisService {
  private readonly logger = new Logger(PingAnalysisService.name);
  private readonly DUPLICATE_WINDOW_SECONDS = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async receivePing(payload: InboundPingPayload): Promise<{
    ping_id: string;
    status: string;
    is_duplicate: boolean;
    duplicate_of_id?: string;
  }> {
    const callerPhone = payload.caller_phone || payload.caller_id || '';
    const callerState = (payload.caller_state || payload.state || '').toUpperCase().slice(0, 2);
    const callerZip = (payload.caller_zip || payload.zip || '').slice(0, 5);
    const callerCity = payload.caller_city || payload.city || '';
    const callerAreaCode = callerPhone.replace(/\D/g, '').slice(0, 3);

    const trafficSourceId = payload.traffic_source_id || '';
    const trafficSource = payload.traffic_source || payload.publisher || '';
    const subId = payload.sub_id || payload.subid || '';
    const offerId = payload.offer_id || '';
    const offerName = payload.offer || payload.offer_name || '';

    // Check for duplicate
    let isDuplicate = false;
    let duplicateOfId: string | undefined;

    if (callerPhone) {
      const windowStart = new Date(Date.now() - this.DUPLICATE_WINDOW_SECONDS * 1000);
      const existingPing = await this.prisma.inbound_ping.findFirst({
        where: {
          caller_phone: callerPhone,
          offer_name: offerName || undefined,
          received_at: { gte: windowStart },
        },
        orderBy: { received_at: 'desc' },
        select: { id: true },
      });

      if (existingPing) {
        isDuplicate = true;
        duplicateOfId = existingPing.id;
      }
    }

    // Store the ping
    const ping = await this.prisma.inbound_ping.create({
      data: {
        trackdrive_call_id: payload.trackdrive_call_id,
        caller_phone: callerPhone,
        caller_state: callerState,
        caller_zip: callerZip,
        caller_city: callerCity,
        caller_area_code: callerAreaCode,
        traffic_source_id: trafficSourceId,
        traffic_source: trafficSource,
        publisher_name: trafficSource,
        sub_id: subId,
        offer_id: offerId,
        offer_name: offerName,
        status: isDuplicate ? 'rejected' : 'pending',
        is_duplicate: isDuplicate,
        duplicate_of_id: duplicateOfId,
        raw_payload: payload as any,
      },
    });

    // If duplicate, create a rejection response
    if (isDuplicate) {
      await this.prisma.ping_response.create({
        data: {
          ping_id: ping.id,
          status: 'rejected',
          rejection_reason: 'Duplicate ping detected',
          rejection_category: 'duplicate',
        },
      });
    }

    this.logger.log(`Ping received: ${ping.id} | ${callerPhone} | ${offerName} | dup=${isDuplicate}`);

    return {
      ping_id: ping.id,
      status: isDuplicate ? 'rejected' : 'pending',
      is_duplicate: isDuplicate,
      duplicate_of_id: duplicateOfId,
    };
  }

  async recordPingResponse(
    pingId: string,
    buyerId: string,
    buyerName: string,
    response: {
      accepted: boolean;
      bid_amount?: number;
      rejection_reason?: string;
      response_time_ms?: number;
      raw_response?: any;
    },
  ): Promise<void> {
    const rejectionCategory = response.rejection_reason
      ? this.categorizeRejection(response.rejection_reason)
      : null;

    await this.prisma.ping_response.create({
      data: {
        ping_id: pingId,
        buyer_id: buyerId,
        buyer_name: buyerName,
        status: response.accepted ? 'accepted' : 'rejected',
        bid_amount: response.accepted ? response.bid_amount : null,
        rejection_reason: response.rejection_reason,
        rejection_category: rejectionCategory,
        response_time_ms: response.response_time_ms,
        raw_response: response.raw_response,
      },
    });
  }

  async finalizePing(pingId: string): Promise<void> {
    const responses = await this.prisma.ping_response.findMany({
      where: { ping_id: pingId },
    });

    const accepts = responses.filter((r) => r.status === 'accepted' && r.bid_amount && r.bid_amount > 0);
    const rejects = responses.filter((r) => r.status === 'rejected');

    let status = 'no_bid';
    let winningBuyerId: string | null = null;
    let winningBuyerName: string | null = null;
    let winningBid: number | null = null;

    if (accepts.length > 0) {
      const winner = accepts.reduce((best, r) => (r.bid_amount! > (best.bid_amount || 0) ? r : best));
      status = 'accepted';
      winningBuyerId = winner.buyer_id;
      winningBuyerName = winner.buyer_name;
      winningBid = winner.bid_amount;

      await this.prisma.ping_response.update({
        where: { id: winner.id },
        data: { is_winner: true },
      });
    } else if (rejects.length > 0) {
      status = 'rejected';
    }

    const avgLatency = responses.length > 0
      ? Math.round(responses.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / responses.length)
      : null;

    await this.prisma.inbound_ping.update({
      where: { id: pingId },
      data: {
        status,
        winning_buyer_id: winningBuyerId,
        winning_buyer_name: winningBuyerName,
        winning_bid: winningBid,
        total_buyers_pinged: responses.length,
        total_accepts: accepts.length,
        total_rejects: rejects.length,
        processing_time_ms: avgLatency,
      },
    });
  }

  private categorizeRejection(reason: string): string {
    const lower = reason.toLowerCase();
    if (lower.includes('cap') || lower.includes('capacity') || lower.includes('budget') || lower.includes('limit')) {
      return 'cap_reached';
    }
    if (lower.includes('state') || lower.includes('geo') || lower.includes('region')) {
      return 'state_not_serviced';
    }
    if (lower.includes('duplicate') || lower.includes('dup')) {
      return 'duplicate';
    }
    if (lower.includes('invalid') || lower.includes('bad') || lower.includes('malformed')) {
      return 'invalid_data';
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
      return 'timeout';
    }
    if (lower.includes('quality')) {
      return 'quality_score';
    }
    if (lower.includes('filter')) {
      return 'filter_rules';
    }
    return 'other';
  }

  async getStats(options: {
    start?: Date;
    end?: Date;
    offer_name?: string;
    traffic_source?: string;
    state?: string;
  }): Promise<PingStats> {
    const where: any = {};

    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }
    if (options.offer_name) where.offer_name = options.offer_name;
    if (options.traffic_source) where.traffic_source = options.traffic_source;
    if (options.state) where.caller_state = options.state;

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        id: true,
        status: true,
        winning_bid: true,
        processing_time_ms: true,
        is_duplicate: true,
        caller_phone: true,
        converted: true,
        call_connected: true,
        call_duration: true,
        actual_payout: true,
      },
    });

    const total = pings.length;
    const accepted = pings.filter((p) => p.status === 'accepted').length;
    const rejected = pings.filter((p) => p.status === 'rejected').length;
    const noBid = pings.filter((p) => p.status === 'no_bid').length;
    const failed = pings.filter((p) => p.status === 'failed').length;
    const duplicates = pings.filter((p) => p.is_duplicate).length;

    const acceptedPings = pings.filter((p) => p.status === 'accepted' && p.winning_bid);
    const totalBid = acceptedPings.reduce((sum, p) => sum + (p.winning_bid || 0), 0);
    const avgBid = acceptedPings.length > 0 ? totalBid / acceptedPings.length : 0;

    const latencies = pings.filter((p) => p.processing_time_ms).map((p) => p.processing_time_ms!);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const uniqueCallers = new Set(pings.map((p) => p.caller_phone).filter(Boolean)).size;

    // Conversion stats
    const connected = pings.filter((p) => p.call_connected).length;
    const converted = pings.filter((p) => p.converted).length;
    const totalPayout = pings.filter((p) => p.actual_payout).reduce((sum, p) => sum + (p.actual_payout || 0), 0);
    const avgDuration = pings.filter((p) => p.call_duration).reduce((sum, p) => sum + (p.call_duration || 0), 0) / (connected || 1);

    return {
      total_pings: total,
      accepted,
      rejected,
      no_bid: noBid,
      failed,
      duplicates,
      accept_rate: total > 0 ? Math.round((accepted / total) * 10000) / 100 : 0,
      total_bid_amount: Math.round(totalBid * 100) / 100,
      avg_bid: Math.round(avgBid * 100) / 100,
      avg_latency_ms: Math.round(avgLatency),
      unique_callers: uniqueCallers,
      // Conversion stats
      calls_connected: connected,
      calls_converted: converted,
      conversion_rate: accepted > 0 ? Math.round((converted / accepted) * 10000) / 100 : 0,
      total_payout: Math.round(totalPayout * 100) / 100,
      avg_call_duration: Math.round(avgDuration),
    };
  }

  async getStatsBySegment(
    segment: 'offer' | 'traffic_source' | 'state' | 'buyer',
    options: { start?: Date; end?: Date; limit?: number },
  ): Promise<SegmentStats[]> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const fieldMap: Record<string, string> = {
      offer: 'offer_name',
      traffic_source: 'traffic_source',
      state: 'caller_state',
      buyer: 'winning_buyer_name',
    };

    const field = fieldMap[segment] || 'offer_name';

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        [field]: true,
        status: true,
        winning_bid: true,
      } as any,
    });

    const groups = new Map<string, any[]>();
    for (const p of pings) {
      const key = (p as any)[field] || 'Unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    const total = pings.length;
    const stats: SegmentStats[] = [];

    for (const [name, group] of groups) {
      const accepted = group.filter((p) => p.status === 'accepted').length;
      const acceptedPings = group.filter((p) => p.status === 'accepted' && p.winning_bid);
      const totalBid = acceptedPings.reduce((sum, p) => sum + (p.winning_bid || 0), 0);

      stats.push({
        name,
        pings: group.length,
        accepted,
        accept_rate: group.length > 0 ? Math.round((accepted / group.length) * 10000) / 100 : 0,
        total_bid: Math.round(totalBid * 100) / 100,
        avg_bid: acceptedPings.length > 0 ? Math.round((totalBid / acceptedPings.length) * 100) / 100 : 0,
        pct_of_total: total > 0 ? Math.round((group.length / total) * 10000) / 100 : 0,
      });
    }

    return stats
      .sort((a, b) => b.pings - a.pings)
      .slice(0, options.limit || 20);
  }

  async getRejectReasons(options: { start?: Date; end?: Date; limit?: number }): Promise<RejectReasonBreakdown[]> {
    const where: any = { status: 'rejected' };
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const responses = await this.prisma.ping_response.findMany({
      where,
      select: { rejection_reason: true },
    });

    const counts = new Map<string, number>();
    for (const r of responses) {
      const reason = r.rejection_reason || 'unknown';
      counts.set(reason, (counts.get(reason) || 0) + 1);
    }

    const total = responses.length;
    const result: RejectReasonBreakdown[] = [];

    for (const [reason, count] of counts) {
      result.push({
        reason,
        count,
        pct: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
      });
    }

    return result
      .sort((a, b) => b.count - a.count)
      .slice(0, options.limit || 10);
  }

  async getDuplicateStats(options: { start?: Date; end?: Date }): Promise<{
    total_pings: number;
    duplicates: number;
    duplicate_rate: number;
    by_traffic_source: { name: string; pings: number; duplicates: number; dup_rate: number }[];
    by_offer: { name: string; pings: number; duplicates: number; dup_rate: number }[];
  }> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        traffic_source: true,
        offer_name: true,
        is_duplicate: true,
      },
    });

    const total = pings.length;
    const duplicates = pings.filter((p) => p.is_duplicate).length;

    const bySource = new Map<string, { total: number; dups: number }>();
    const byOffer = new Map<string, { total: number; dups: number }>();

    for (const p of pings) {
      const source = p.traffic_source || 'Unknown';
      const offer = p.offer_name || 'Unknown';

      if (!bySource.has(source)) bySource.set(source, { total: 0, dups: 0 });
      bySource.get(source)!.total++;
      if (p.is_duplicate) bySource.get(source)!.dups++;

      if (!byOffer.has(offer)) byOffer.set(offer, { total: 0, dups: 0 });
      byOffer.get(offer)!.total++;
      if (p.is_duplicate) byOffer.get(offer)!.dups++;
    }

    return {
      total_pings: total,
      duplicates,
      duplicate_rate: total > 0 ? Math.round((duplicates / total) * 10000) / 100 : 0,
      by_traffic_source: [...bySource.entries()]
        .map(([name, data]) => ({
          name,
          pings: data.total,
          duplicates: data.dups,
          dup_rate: data.total > 0 ? Math.round((data.dups / data.total) * 10000) / 100 : 0,
        }))
        .filter((x) => x.duplicates > 0)
        .sort((a, b) => b.duplicates - a.duplicates)
        .slice(0, 15),
      by_offer: [...byOffer.entries()]
        .map(([name, data]) => ({
          name,
          pings: data.total,
          duplicates: data.dups,
          dup_rate: data.total > 0 ? Math.round((data.dups / data.total) * 10000) / 100 : 0,
        }))
        .filter((x) => x.duplicates > 0)
        .sort((a, b) => b.duplicates - a.duplicates)
        .slice(0, 15),
    };
  }

  async getLiveFeed(limit = 20): Promise<any[]> {
    const pings = await this.prisma.inbound_ping.findMany({
      take: limit,
      orderBy: { received_at: 'desc' },
      select: {
        id: true,
        received_at: true,
        caller_state: true,
        caller_phone: true,
        offer_name: true,
        traffic_source: true,
        status: true,
        winning_bid: true,
        winning_buyer_name: true,
        publisher_payout: true,
        margin: true,
        total_buyers_pinged: true,
        total_accepts: true,
        total_rejects: true,
        processing_time_ms: true,
        is_duplicate: true,
        // Conversion data
        converted: true,
        call_connected: true,
        call_duration: true,
        actual_payout: true,
      },
    });

    return pings;
  }

  async getPingDetail(pingId: string): Promise<any> {
    const ping = await this.prisma.inbound_ping.findUnique({
      where: { id: pingId },
      include: {
        responses: {
          orderBy: { response_time_ms: 'asc' },
        },
      },
    });

    if (!ping) return null;

    const timeline: any[] = [
      { time: '0ms', event: 'received', detail: `Ping received from ${ping.traffic_source || 'Unknown'}` },
    ];

    if (ping.responses.length > 0) {
      timeline.push({ time: '1ms', event: 'sent', detail: `Sent to ${ping.responses.length} buyers` });

      for (const r of ping.responses) {
        if (r.status === 'accepted') {
          timeline.push({
            time: `${r.response_time_ms || 0}ms`,
            event: 'accept',
            detail: `${r.buyer_name}: $${r.bid_amount?.toFixed(2) || '0.00'}`,
            is_winner: r.is_winner,
          });
        } else {
          timeline.push({
            time: `${r.response_time_ms || 0}ms`,
            event: 'reject',
            detail: `${r.buyer_name}: ${r.rejection_reason || 'No reason'}`,
          });
        }
      }
    }

    if (ping.status === 'accepted') {
      timeline.push({
        time: `${ping.processing_time_ms || 0}ms`,
        event: 'winner',
        detail: `Winner: ${ping.winning_buyer_name} at $${ping.winning_bid?.toFixed(2) || '0.00'}`,
      });
    } else {
      timeline.push({
        time: `${ping.processing_time_ms || 0}ms`,
        event: 'no_winner',
        detail: ping.is_duplicate ? 'Rejected: Duplicate' : 'No buyer accepted',
      });
    }

    const accepts = ping.responses.filter((r) => r.status === 'accepted');

    return {
      ping,
      timeline,
      summary: {
        total_sent: ping.responses.length,
        accepts: accepts.length,
        rejects: ping.responses.length - accepts.length,
        highest_bid: accepts.length > 0 ? Math.max(...accepts.map((r) => r.bid_amount || 0)) : 0,
        lowest_bid: accepts.length > 0 ? Math.min(...accepts.map((r) => r.bid_amount || 0)) : 0,
        avg_response_ms: ping.processing_time_ms || 0,
      },
    };
  }

  async getTrends(options: {
    start?: Date;
    end?: Date;
    offer_name?: string;
    traffic_source?: string;
    state?: string;
    granularity?: 'hour' | 'day';
  }): Promise<TrendDataPoint[]> {
    const where: any = {};

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    where.received_at = {
      gte: options.start || defaultStart,
      lte: options.end || now,
    };

    if (options.offer_name) where.offer_name = options.offer_name;
    if (options.traffic_source) where.traffic_source = options.traffic_source;
    if (options.state) where.caller_state = options.state;

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        received_at: true,
        status: true,
        winning_bid: true,
        is_duplicate: true,
      },
      orderBy: { received_at: 'asc' },
    });

    const granularity = options.granularity || 'hour';
    const groups = new Map<string, any[]>();

    for (const p of pings) {
      const date = new Date(p.received_at);
      let key: string;

      if (granularity === 'hour') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    const trends: TrendDataPoint[] = [];

    for (const [timestamp, group] of groups) {
      const total = group.length;
      const accepted = group.filter(p => p.status === 'accepted').length;
      const rejected = group.filter(p => p.status === 'rejected').length;
      const duplicates = group.filter(p => p.is_duplicate).length;
      const acceptedWithBid = group.filter(p => p.status === 'accepted' && p.winning_bid);
      const totalBid = acceptedWithBid.reduce((sum, p) => sum + (p.winning_bid || 0), 0);

      trends.push({
        timestamp,
        pings: total,
        accepted,
        rejected,
        accept_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        total_bid: Math.round(totalBid * 100) / 100,
        avg_bid: acceptedWithBid.length > 0 ? Math.round((totalBid / acceptedWithBid.length) * 100) / 100 : 0,
        duplicates,
      });
    }

    return trends;
  }

  async getHourlyBreakdown(options: {
    start?: Date;
    end?: Date;
    offer_name?: string;
    traffic_source?: string;
  }): Promise<HourlyBreakdown[]> {
    const where: any = {};

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    where.received_at = {
      gte: options.start || defaultStart,
      lte: options.end || now,
    };

    if (options.offer_name) where.offer_name = options.offer_name;
    if (options.traffic_source) where.traffic_source = options.traffic_source;

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        received_at: true,
        status: true,
        winning_bid: true,
      },
    });

    const grid = new Map<string, any[]>();

    for (const p of pings) {
      const date = new Date(p.received_at);
      const hour = date.getHours();
      const dow = date.getDay();
      const key = `${dow}-${hour}`;

      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(p);
    }

    const result: HourlyBreakdown[] = [];

    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${dow}-${hour}`;
        const group = grid.get(key) || [];
        const total = group.length;
        const accepted = group.filter(p => p.status === 'accepted').length;
        const acceptedWithBid = group.filter(p => p.status === 'accepted' && p.winning_bid);
        const totalBid = acceptedWithBid.reduce((sum, p) => sum + (p.winning_bid || 0), 0);

        result.push({
          hour,
          day_of_week: dow,
          pings: total,
          accepted,
          accept_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
          avg_bid: acceptedWithBid.length > 0 ? Math.round((totalBid / acceptedWithBid.length) * 100) / 100 : 0,
        });
      }
    }

    return result;
  }

  async getCoverageMap(options: {
    start?: Date;
    end?: Date;
    offer_name?: string;
    traffic_source?: string;
  }): Promise<StateCoverage[]> {
    const where: any = {};

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    where.received_at = {
      gte: options.start || defaultStart,
      lte: options.end || now,
    };

    if (options.offer_name) where.offer_name = options.offer_name;
    if (options.traffic_source) where.traffic_source = options.traffic_source;

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        caller_state: true,
        status: true,
        winning_bid: true,
      },
    });

    const states = new Map<string, any[]>();

    for (const p of pings) {
      const state = (p.caller_state || '').toUpperCase();
      if (!state || state.length !== 2) continue;

      if (!states.has(state)) states.set(state, []);
      states.get(state)!.push(p);
    }

    const totalPings = pings.length;
    const result: StateCoverage[] = [];

    for (const [state, group] of states) {
      const total = group.length;
      const accepted = group.filter(p => p.status === 'accepted').length;
      const rejected = group.filter(p => p.status === 'rejected').length;
      const acceptedWithBid = group.filter(p => p.status === 'accepted' && p.winning_bid);
      const totalBid = acceptedWithBid.reduce((sum, p) => sum + (p.winning_bid || 0), 0);
      const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

      result.push({
        state,
        pings: total,
        accepted,
        rejected,
        accept_rate: acceptRate,
        total_bid: Math.round(totalBid * 100) / 100,
        avg_bid: acceptedWithBid.length > 0 ? Math.round((totalBid / acceptedWithBid.length) * 100) / 100 : 0,
        coverage_score: Math.round((acceptRate * (total / (totalPings || 1))) * 100) / 100,
      });
    }

    return result.sort((a, b) => b.pings - a.pings);
  }

  async getBidAnalysis(options: {
    start?: Date;
    end?: Date;
    offer_name?: string;
    traffic_source?: string;
    state?: string;
  }): Promise<BidAnalysis> {
    const where: any = {};

    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    where.received_at = {
      gte: options.start || defaultStart,
      lte: options.end || now,
    };

    if (options.offer_name) where.offer_name = options.offer_name;
    if (options.traffic_source) where.traffic_source = options.traffic_source;
    if (options.state) where.caller_state = options.state;

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      select: {
        status: true,
        winning_bid: true,
        winning_buyer_name: true,
      },
    });

    const bids = pings
      .filter(p => p.status === 'accepted' && p.winning_bid && p.winning_bid > 0)
      .map(p => ({ bid: p.winning_bid!, buyer: p.winning_buyer_name || 'Unknown' }));

    if (bids.length === 0) {
      return {
        total_bids: 0,
        avg_bid: 0,
        min_bid: 0,
        max_bid: 0,
        median_bid: 0,
        p25_bid: 0,
        p75_bid: 0,
        suggested_floor: 0,
        distribution: [],
        by_buyer: [],
      };
    }

    const sortedBids = bids.map(b => b.bid).sort((a, b) => a - b);
    const total = sortedBids.length;
    const sum = sortedBids.reduce((a, b) => a + b, 0);

    const percentile = (arr: number[], p: number) => {
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const minBid = sortedBids[0];
    const maxBid = sortedBids[total - 1];
    const avgBid = sum / total;
    const medianBid = percentile(sortedBids, 50);
    const p25 = percentile(sortedBids, 25);
    const p75 = percentile(sortedBids, 75);

    const suggestedFloor = Math.round(p25 * 0.9 * 100) / 100;

    const ranges = [
      { min: 0, max: 10, label: '$0-10' },
      { min: 10, max: 20, label: '$10-20' },
      { min: 20, max: 30, label: '$20-30' },
      { min: 30, max: 50, label: '$30-50' },
      { min: 50, max: 75, label: '$50-75' },
      { min: 75, max: 100, label: '$75-100' },
      { min: 100, max: Infinity, label: '$100+' },
    ];

    const distribution = ranges.map(r => {
      const count = sortedBids.filter(b => b >= r.min && b < r.max).length;
      return {
        range: r.label,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    const buyerStats = new Map<string, { bids: number[]; wins: number }>();

    for (const b of bids) {
      if (!buyerStats.has(b.buyer)) {
        buyerStats.set(b.buyer, { bids: [], wins: 0 });
      }
      buyerStats.get(b.buyer)!.bids.push(b.bid);
      buyerStats.get(b.buyer)!.wins++;
    }

    const byBuyer = [...buyerStats.entries()]
      .map(([buyer, data]) => ({
        buyer,
        avg_bid: Math.round((data.bids.reduce((a, b) => a + b, 0) / data.bids.length) * 100) / 100,
        win_rate: Math.round((data.wins / total) * 100),
        total_bids: data.wins,
      }))
      .sort((a, b) => b.total_bids - a.total_bids)
      .slice(0, 10);

    return {
      total_bids: total,
      avg_bid: Math.round(avgBid * 100) / 100,
      min_bid: Math.round(minBid * 100) / 100,
      max_bid: Math.round(maxBid * 100) / 100,
      median_bid: Math.round(medianBid * 100) / 100,
      p25_bid: Math.round(p25 * 100) / 100,
      p75_bid: Math.round(p75 * 100) / 100,
      suggested_floor: suggestedFloor,
      distribution,
      by_buyer: byBuyer,
    };
  }

  async getFilterOptions(): Promise<{
    offers: string[];
    traffic_sources: string[];
    states: string[];
    buyers: string[];
  }> {
    const [offers, sources, states, buyers] = await Promise.all([
      this.prisma.inbound_ping.findMany({
        select: { offer_name: true },
        distinct: ['offer_name'],
        where: { offer_name: { not: null } },
      }),
      this.prisma.inbound_ping.findMany({
        select: { traffic_source: true },
        distinct: ['traffic_source'],
        where: { traffic_source: { not: null } },
      }),
      this.prisma.inbound_ping.findMany({
        select: { caller_state: true },
        distinct: ['caller_state'],
        where: { caller_state: { not: null } },
      }),
      this.prisma.inbound_ping.findMany({
        select: { winning_buyer_name: true },
        distinct: ['winning_buyer_name'],
        where: { winning_buyer_name: { not: null } },
      }),
    ]);

    return {
      offers: offers.map(o => o.offer_name!).filter(Boolean).sort(),
      traffic_sources: sources.map(s => s.traffic_source!).filter(Boolean).sort(),
      states: states.map(s => s.caller_state!).filter(Boolean).sort(),
      buyers: buyers.map(b => b.winning_buyer_name!).filter(Boolean).sort(),
    };
  }
}
