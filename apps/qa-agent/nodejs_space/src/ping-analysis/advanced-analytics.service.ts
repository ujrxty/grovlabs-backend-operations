import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// ============================================
// INTERFACES
// ============================================

export interface DuplicateCaller {
  caller_phone: string;
  occurrence_count: number;
  first_seen: Date;
  last_seen: Date;
  time_between_calls_minutes: number;
  states_seen: string[];
  offers_hit: string[];
  publishers_from: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_reasons: string[];
}

export interface FraudStats {
  total_pings: number;
  unique_callers: number;
  duplicate_callers: number;
  duplicate_rate: number;
  high_risk_count: number;
  by_publisher: { publisher: string; duplicate_rate: number; total: number; duplicates: number }[];
  by_offer: { offer: string; duplicate_rate: number; total: number; duplicates: number }[];
  recent_duplicates: DuplicateCaller[];
  area_code_analysis: { area_code: string; count: number; duplicate_rate: number }[];
}

export interface BuyerPerformance {
  buyer_id: string;
  buyer_name: string;
  total_pings_received: number;
  total_accepts: number;
  total_rejects: number;
  accept_rate: number;
  avg_bid: number;
  highest_bid: number;
  lowest_bid: number;
  avg_response_ms: number;
  consistency_score: number; // How consistent are their bids
  reliability_score: number; // How often do they respond
  total_revenue: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
  states_covered: string[];
  peak_hours: number[];
}

export interface PublisherQuality {
  publisher_name: string;
  traffic_source_id: string | null;
  total_pings: number;
  accepted_pings: number;
  accept_rate: number;
  duplicate_rate: number;
  avg_bid_generated: number;
  total_revenue: number;
  unique_callers: number;
  repeat_caller_rate: number;
  quality_score: number; // 0-100
  fraud_signals: string[];
  states_sending: { state: string; count: number }[];
  best_performing_hour: number;
  worst_performing_hour: number;
  recommendation: string;
}

export interface CoverageGap {
  state: string;
  pings_received: number;
  buyers_active: number;
  accept_rate: number;
  avg_bid: number;
  potential_revenue: number;
  gap_type: 'no_buyer' | 'low_accept' | 'low_bid' | 'opportunity';
  recommendation: string;
  estimated_monthly_value: number;
}

export interface Anomaly {
  id: string;
  detected_at: Date;
  type: 'accept_rate_drop' | 'latency_spike' | 'duplicate_surge' | 'buyer_stopped' | 'traffic_spike' | 'traffic_drop' | 'bid_drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric_name: string;
  expected_value: number;
  actual_value: number;
  deviation_pct: number;
  context: string;
  affected_entity: string;
  affected_entity_type: 'buyer' | 'publisher' | 'state' | 'offer' | 'global';
  is_resolved: boolean;
  resolved_at: Date | null;
}

export interface LatencyBreakdown {
  ping_id: string;
  total_ms: number;
  relay_receive_ms: number;
  db_lookup_ms: number;
  buyer_network_ms: number;
  buyer_processing_ms: number;
  relay_response_ms: number;
  bottleneck: 'relay' | 'network' | 'buyer' | 'db';
}

export interface LatencyStats {
  avg_total_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  by_buyer: { buyer: string; avg_ms: number; p95_ms: number }[];
  by_state: { state: string; avg_ms: number }[];
  slowest_pings: { ping_id: string; total_ms: number; buyer: string; timestamp: Date }[];
}

export interface RevenueOpportunity {
  type: 'routing' | 'coverage' | 'timing' | 'buyer';
  title: string;
  description: string;
  current_value: number;
  potential_value: number;
  increase_pct: number;
  confidence: number;
  action: string;
  affected_pings_per_day: number;
}

export interface GeoHeatmapData {
  state: string;
  state_name: string;
  pings: number;
  accepted: number;
  accept_rate: number;
  avg_bid: number;
  total_revenue: number;
  top_buyer: string;
  intensity: number; // 0-1 for heatmap coloring
}

export interface TimeHeatmapCell {
  hour: number;
  day: number; // 0=Sunday
  pings: number;
  accept_rate: number;
  avg_bid: number;
  intensity: number;
}

export interface PingReplayResult {
  original_ping_id: string;
  simulated_at: Date;
  original_result: { buyer: string; bid: number; accepted: boolean };
  simulated_result: { buyer: string; bid: number; accepted: boolean };
  difference: { bid_diff: number; would_change_winner: boolean };
}

@Injectable()
export class AdvancedAnalyticsService {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // DUPLICATE & FRAUD DETECTION
  // ============================================

  async getFraudStats(options: { start?: Date; end?: Date } = {}): Promise<FraudStats> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      orderBy: { received_at: 'desc' },
    });

    const callerMap = new Map<string, typeof pings>();
    pings.forEach(p => {
      if (!p.caller_phone) return;
      if (!callerMap.has(p.caller_phone)) callerMap.set(p.caller_phone, []);
      callerMap.get(p.caller_phone)!.push(p);
    });

    const duplicateCallers: DuplicateCaller[] = [];
    let highRiskCount = 0;

    for (const [phone, callerPings] of callerMap.entries()) {
      if (callerPings.length <= 1) continue;

      const sorted = callerPings.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
      const firstSeen = sorted[0].received_at;
      const lastSeen = sorted[sorted.length - 1].received_at;
      const timeBetween = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (1000 * 60);

      const states = [...new Set(sorted.map(p => p.caller_state).filter(Boolean))] as string[];
      const offers = [...new Set(sorted.map(p => p.offer_name).filter(Boolean))] as string[];
      const publishers = [...new Set(sorted.map(p => p.traffic_source || p.publisher_name).filter(Boolean))] as string[];

      const riskReasons: string[] = [];
      let riskScore = 0;

      if (callerPings.length >= 5) {
        riskReasons.push(`Called ${callerPings.length} times`);
        riskScore += 4;
      } else if (callerPings.length >= 3) {
        riskReasons.push(`Called ${callerPings.length} times`);
        riskScore += 3;
      } else {
        riskReasons.push('Repeat caller');
        riskScore += 2;
      }

      if (timeBetween < 60) {
        riskReasons.push(`${Math.round(timeBetween)} min between calls`);
        riskScore += 2;
      }

      if (offers.length > 1) {
        riskReasons.push(`Hit ${offers.length} different offers`);
        riskScore += 1;
      }

      if (publishers.length > 1) {
        riskReasons.push(`From ${publishers.length} different publishers`);
        riskScore += 1;
      }

      const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
        riskScore >= 5 ? 'critical' :
        riskScore >= 4 ? 'high' :
        riskScore >= 2 ? 'medium' : 'low';

      if (riskLevel === 'high' || riskLevel === 'critical') highRiskCount++;

      duplicateCallers.push({
        caller_phone: phone,
        occurrence_count: callerPings.length,
        first_seen: firstSeen,
        last_seen: lastSeen,
        time_between_calls_minutes: Math.round(timeBetween),
        states_seen: states,
        offers_hit: offers,
        publishers_from: publishers,
        risk_level: riskLevel,
        risk_reasons: riskReasons,
      });
    }

    duplicateCallers.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return riskOrder[a.risk_level] - riskOrder[b.risk_level] || b.occurrence_count - a.occurrence_count;
    });

    // By publisher
    const pubMap = new Map<string, { total: number; duplicates: Set<string> }>();
    pings.forEach(p => {
      const pub = p.traffic_source || p.publisher_name || 'Unknown';
      if (!pubMap.has(pub)) pubMap.set(pub, { total: 0, duplicates: new Set() });
      pubMap.get(pub)!.total++;
      if (p.caller_phone && callerMap.get(p.caller_phone)!.length > 1) {
        pubMap.get(pub)!.duplicates.add(p.caller_phone);
      }
    });

    const byPublisher = [...pubMap.entries()].map(([publisher, data]) => ({
      publisher,
      total: data.total,
      duplicates: data.duplicates.size,
      duplicate_rate: data.total > 0 ? Math.round((data.duplicates.size / data.total) * 10000) / 100 : 0,
    })).sort((a, b) => b.duplicate_rate - a.duplicate_rate);

    // By offer
    const offerMap = new Map<string, { total: number; duplicates: Set<string> }>();
    pings.forEach(p => {
      const offer = p.offer_name || 'Unknown';
      if (!offerMap.has(offer)) offerMap.set(offer, { total: 0, duplicates: new Set() });
      offerMap.get(offer)!.total++;
      if (p.caller_phone && callerMap.get(p.caller_phone)!.length > 1) {
        offerMap.get(offer)!.duplicates.add(p.caller_phone);
      }
    });

    const byOffer = [...offerMap.entries()].map(([offer, data]) => ({
      offer,
      total: data.total,
      duplicates: data.duplicates.size,
      duplicate_rate: data.total > 0 ? Math.round((data.duplicates.size / data.total) * 10000) / 100 : 0,
    })).sort((a, b) => b.duplicate_rate - a.duplicate_rate);

    // Area code analysis
    const areaCodeMap = new Map<string, { total: number; duplicates: Set<string> }>();
    pings.forEach(p => {
      const areaCode = p.caller_phone?.replace(/\D/g, '').slice(0, 3) || p.caller_area_code || 'Unknown';
      if (!areaCodeMap.has(areaCode)) areaCodeMap.set(areaCode, { total: 0, duplicates: new Set() });
      areaCodeMap.get(areaCode)!.total++;
      if (p.caller_phone && callerMap.get(p.caller_phone)!.length > 1) {
        areaCodeMap.get(areaCode)!.duplicates.add(p.caller_phone);
      }
    });

    const areaCodeAnalysis = [...areaCodeMap.entries()].map(([area_code, data]) => ({
      area_code,
      count: data.total,
      duplicate_rate: data.total > 0 ? Math.round((data.duplicates.size / data.total) * 10000) / 100 : 0,
    })).sort((a, b) => b.duplicate_rate - a.duplicate_rate).slice(0, 20);

    return {
      total_pings: pings.length,
      unique_callers: callerMap.size,
      duplicate_callers: duplicateCallers.length,
      duplicate_rate: callerMap.size > 0 ? Math.round((duplicateCallers.length / callerMap.size) * 10000) / 100 : 0,
      high_risk_count: highRiskCount,
      by_publisher: byPublisher.slice(0, 10),
      by_offer: byOffer.slice(0, 10),
      recent_duplicates: duplicateCallers.slice(0, 50),
      area_code_analysis: areaCodeAnalysis,
    };
  }

  async getDuplicateCallers(limit: number = 50): Promise<DuplicateCaller[]> {
    const stats = await this.getFraudStats();
    return stats.recent_duplicates.slice(0, limit);
  }

  // ============================================
  // BUYER PERFORMANCE LEADERBOARD
  // ============================================

  async getBuyerLeaderboard(options: { start?: Date; end?: Date } = {}): Promise<BuyerPerformance[]> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const responses = await this.prisma.ping_response.findMany({
      where,
      include: { ping: true },
    });

    const buyerMap = new Map<string, {
      buyer_id: string;
      buyer_name: string;
      pings: number;
      accepts: number;
      rejects: number;
      bids: number[];
      latencies: number[];
      states: Set<string>;
      hours: Map<number, number>;
    }>();

    for (const r of responses) {
      const key = r.buyer_id || 'unknown';
      if (!buyerMap.has(key)) {
        buyerMap.set(key, {
          buyer_id: r.buyer_id || 'unknown',
          buyer_name: r.buyer_name || 'Unknown Buyer',
          pings: 0,
          accepts: 0,
          rejects: 0,
          bids: [],
          latencies: [],
          states: new Set(),
          hours: new Map(),
        });
      }
      const b = buyerMap.get(key)!;
      b.pings++;
      if (r.status === 'accepted') {
        b.accepts++;
        if (r.bid_amount) b.bids.push(r.bid_amount);
      } else {
        b.rejects++;
      }
      if (r.response_time_ms) b.latencies.push(r.response_time_ms);
      if (r.ping?.caller_state) b.states.add(r.ping.caller_state);

      const hour = new Date(r.received_at).getHours();
      b.hours.set(hour, (b.hours.get(hour) || 0) + 1);
    }

    const results: BuyerPerformance[] = [];
    let rank = 1;

    for (const [, b] of buyerMap) {
      const avgBid = b.bids.length > 0 ? b.bids.reduce((a, c) => a + c, 0) / b.bids.length : 0;
      const avgLatency = b.latencies.length > 0 ? b.latencies.reduce((a, c) => a + c, 0) / b.latencies.length : 0;

      // Consistency score - lower std dev = more consistent
      let consistencyScore = 100;
      if (b.bids.length > 1) {
        const mean = avgBid;
        const variance = b.bids.reduce((sum, bid) => sum + Math.pow(bid - mean, 2), 0) / b.bids.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
        consistencyScore = Math.max(0, 100 - cv);
      }

      // Peak hours - top 3 hours by activity
      const sortedHours = [...b.hours.entries()].sort((a, b) => b[1] - a[1]);
      const peakHours = sortedHours.slice(0, 3).map(h => h[0]);

      results.push({
        buyer_id: b.buyer_id,
        buyer_name: b.buyer_name,
        total_pings_received: b.pings,
        total_accepts: b.accepts,
        total_rejects: b.rejects,
        accept_rate: b.pings > 0 ? Math.round((b.accepts / b.pings) * 10000) / 100 : 0,
        avg_bid: Math.round(avgBid * 100) / 100,
        highest_bid: b.bids.length > 0 ? Math.max(...b.bids) : 0,
        lowest_bid: b.bids.length > 0 ? Math.min(...b.bids) : 0,
        avg_response_ms: Math.round(avgLatency),
        consistency_score: Math.round(consistencyScore),
        reliability_score: b.pings > 0 ? Math.round((b.accepts + b.rejects) / b.pings * 100) : 0,
        total_revenue: Math.round(b.bids.reduce((a, c) => a + c, 0) * 100) / 100,
        rank: 0, // Will set after sorting
        trend: 'stable', // TODO: Calculate from historical data
        states_covered: [...b.states],
        peak_hours: peakHours,
      });
    }

    // Sort by total revenue and assign ranks
    results.sort((a, b) => b.total_revenue - a.total_revenue);
    results.forEach((r, i) => r.rank = i + 1);

    return results;
  }

  // ============================================
  // PUBLISHER QUALITY SCORING
  // ============================================

  async getPublisherQuality(options: { start?: Date; end?: Date } = {}): Promise<PublisherQuality[]> {
    const where: any = { traffic_source: { not: null } };
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      include: { responses: true },
    });

    const pubMap = new Map<string, {
      name: string;
      pings: any[];
      callers: Set<string>;
      states: Map<string, number>;
      hours: Map<number, { pings: number; accepted: number }>;
    }>();

    for (const p of pings) {
      const key = p.traffic_source || 'Unknown';
      if (!pubMap.has(key)) {
        pubMap.set(key, {
          name: key,
          pings: [],
          callers: new Set(),
          states: new Map(),
          hours: new Map(),
        });
      }
      const pub = pubMap.get(key)!;
      pub.pings.push(p);
      if (p.caller_phone) pub.callers.add(p.caller_phone);
      if (p.caller_state) {
        pub.states.set(p.caller_state, (pub.states.get(p.caller_state) || 0) + 1);
      }

      const hour = new Date(p.received_at).getHours();
      const hourData = pub.hours.get(hour) || { pings: 0, accepted: 0 };
      hourData.pings++;
      if (p.status === 'accepted') hourData.accepted++;
      pub.hours.set(hour, hourData);
    }

    const results: PublisherQuality[] = [];

    for (const [name, pub] of pubMap) {
      const accepted = pub.pings.filter(p => p.status === 'accepted');
      const duplicates = pub.pings.filter(p => p.is_duplicate);
      const bids = accepted.map(p => p.winning_bid).filter(b => b != null) as number[];
      const totalRevenue = bids.reduce((a, b) => a + b, 0);

      // Calculate repeat caller rate
      const callerPings = new Map<string, number>();
      pub.pings.forEach(p => {
        if (p.caller_phone) {
          callerPings.set(p.caller_phone, (callerPings.get(p.caller_phone) || 0) + 1);
        }
      });
      const repeatCallers = [...callerPings.values()].filter(c => c > 1).length;
      const repeatRate = pub.callers.size > 0 ? (repeatCallers / pub.callers.size) * 100 : 0;

      // Find best/worst hours
      let bestHour = 0, worstHour = 0, bestRate = 0, worstRate = 100;
      pub.hours.forEach((data, hour) => {
        const rate = data.pings > 0 ? (data.accepted / data.pings) * 100 : 0;
        if (rate > bestRate) { bestRate = rate; bestHour = hour; }
        if (rate < worstRate) { worstRate = rate; worstHour = hour; }
      });

      // Fraud signals
      const fraudSignals: string[] = [];
      if (duplicates.length / pub.pings.length > 0.1) fraudSignals.push('High duplicate rate (>10%)');
      if (repeatRate > 50) fraudSignals.push('Excessive repeat callers (>50%)');
      if (pub.states.size === 1 && pub.pings.length > 50) fraudSignals.push('Single state traffic only');

      // Quality score
      const acceptRate = pub.pings.length > 0 ? (accepted.length / pub.pings.length) * 100 : 0;
      const dupPenalty = (duplicates.length / pub.pings.length) * 30;
      const fraudPenalty = fraudSignals.length * 10;
      const qualityScore = Math.max(0, Math.min(100, Math.round(acceptRate - dupPenalty - fraudPenalty)));

      // Recommendation
      let recommendation = 'Good quality traffic';
      if (qualityScore < 30) recommendation = 'Consider pausing - low quality';
      else if (qualityScore < 50) recommendation = 'Monitor closely - declining quality';
      else if (fraudSignals.length > 0) recommendation = 'Review fraud signals';
      else if (acceptRate > 60) recommendation = 'High performer - consider increasing caps';

      results.push({
        publisher_name: name,
        traffic_source_id: null,
        total_pings: pub.pings.length,
        accepted_pings: accepted.length,
        accept_rate: Math.round(acceptRate * 100) / 100,
        duplicate_rate: Math.round((duplicates.length / pub.pings.length) * 10000) / 100,
        avg_bid_generated: bids.length > 0 ? Math.round((totalRevenue / bids.length) * 100) / 100 : 0,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        unique_callers: pub.callers.size,
        repeat_caller_rate: Math.round(repeatRate * 100) / 100,
        quality_score: qualityScore,
        fraud_signals: fraudSignals,
        states_sending: [...pub.states.entries()]
          .map(([state, count]) => ({ state, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        best_performing_hour: bestHour,
        worst_performing_hour: worstHour,
        recommendation,
      });
    }

    return results.sort((a, b) => b.total_revenue - a.total_revenue);
  }

  // ============================================
  // COVERAGE GAP ANALYSIS
  // ============================================

  async getCoverageGaps(): Promise<CoverageGap[]> {
    const allStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ];

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pings = await this.prisma.inbound_ping.findMany({
      where: {
        received_at: { gte: thirtyDaysAgo },
        caller_state: { not: null },
      },
      include: { responses: true },
    });

    const stateData = new Map<string, {
      pings: number;
      accepted: number;
      bids: number[];
      buyers: Set<string>;
    }>();

    // Initialize all states
    allStates.forEach(s => stateData.set(s, { pings: 0, accepted: 0, bids: [], buyers: new Set() }));

    for (const p of pings) {
      const state = p.caller_state?.toUpperCase();
      if (!state || !stateData.has(state)) continue;

      const data = stateData.get(state)!;
      data.pings++;
      if (p.status === 'accepted') {
        data.accepted++;
        if (p.winning_bid) data.bids.push(p.winning_bid);
      }
      p.responses.forEach(r => {
        if (r.status === 'accepted' && r.buyer_name) data.buyers.add(r.buyer_name);
      });
    }

    const gaps: CoverageGap[] = [];

    for (const [state, data] of stateData) {
      if (data.pings === 0) continue; // Skip states with no traffic

      const acceptRate = data.pings > 0 ? (data.accepted / data.pings) * 100 : 0;
      const avgBid = data.bids.length > 0 ? data.bids.reduce((a, b) => a + b, 0) / data.bids.length : 0;
      const currentRevenue = data.bids.reduce((a, b) => a + b, 0);

      // Calculate potential - assume 50% accept rate is achievable
      const potentialAccepts = Math.round(data.pings * 0.5);
      const potentialRevenue = potentialAccepts * (avgBid || 30); // Default to $30 avg bid

      let gapType: CoverageGap['gap_type'] = 'opportunity';
      let recommendation = '';

      if (data.buyers.size === 0) {
        gapType = 'no_buyer';
        recommendation = `No active buyers. Add a buyer to capture ~$${Math.round(potentialRevenue / 30)}/month`;
      } else if (acceptRate < 20) {
        gapType = 'low_accept';
        recommendation = `Low accept rate (${acceptRate.toFixed(1)}%). Review buyer caps or add more buyers.`;
      } else if (avgBid < 20) {
        gapType = 'low_bid';
        recommendation = `Low average bid ($${avgBid.toFixed(2)}). Consider adding higher-paying buyers.`;
      } else {
        recommendation = `Good coverage. Consider increasing traffic caps.`;
      }

      gaps.push({
        state,
        pings_received: data.pings,
        buyers_active: data.buyers.size,
        accept_rate: Math.round(acceptRate * 100) / 100,
        avg_bid: Math.round(avgBid * 100) / 100,
        potential_revenue: Math.round((potentialRevenue - currentRevenue) * 100) / 100,
        gap_type: gapType,
        recommendation,
        estimated_monthly_value: Math.round(potentialRevenue),
      });
    }

    // Sort by potential revenue opportunity
    return gaps
      .filter(g => g.gap_type !== 'opportunity' || g.potential_revenue > 0)
      .sort((a, b) => b.potential_revenue - a.potential_revenue);
  }

  // ============================================
  // GEOGRAPHIC HEATMAP DATA
  // ============================================

  async getGeoHeatmap(options: { start?: Date; end?: Date } = {}): Promise<GeoHeatmapData[]> {
    const stateNames: Record<string, string> = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
      'DC': 'District of Columbia',
    };

    const where: any = { caller_state: { not: null } };
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      include: { responses: true },
    });

    const stateMap = new Map<string, {
      pings: number;
      accepted: number;
      bids: number[];
      buyers: Map<string, number>;
    }>();

    let maxPings = 0;

    for (const p of pings) {
      const state = p.caller_state?.toUpperCase();
      if (!state) continue;

      if (!stateMap.has(state)) {
        stateMap.set(state, { pings: 0, accepted: 0, bids: [], buyers: new Map() });
      }
      const data = stateMap.get(state)!;
      data.pings++;
      maxPings = Math.max(maxPings, data.pings);

      if (p.status === 'accepted') {
        data.accepted++;
        if (p.winning_bid) data.bids.push(p.winning_bid);
        if (p.winning_buyer_name) {
          data.buyers.set(p.winning_buyer_name, (data.buyers.get(p.winning_buyer_name) || 0) + 1);
        }
      }
    }

    const results: GeoHeatmapData[] = [];

    for (const [state, data] of stateMap) {
      const totalRevenue = data.bids.reduce((a, b) => a + b, 0);
      const avgBid = data.bids.length > 0 ? totalRevenue / data.bids.length : 0;

      // Find top buyer
      let topBuyer = 'None';
      let topBuyerCount = 0;
      data.buyers.forEach((count, buyer) => {
        if (count > topBuyerCount) {
          topBuyerCount = count;
          topBuyer = buyer;
        }
      });

      results.push({
        state,
        state_name: stateNames[state] || state,
        pings: data.pings,
        accepted: data.accepted,
        accept_rate: data.pings > 0 ? Math.round((data.accepted / data.pings) * 10000) / 100 : 0,
        avg_bid: Math.round(avgBid * 100) / 100,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        top_buyer: topBuyer,
        intensity: maxPings > 0 ? data.pings / maxPings : 0,
      });
    }

    return results.sort((a, b) => b.pings - a.pings);
  }

  // ============================================
  // TIME HEATMAP - Hour x Day matrix
  // ============================================

  async getTimeHeatmap(options: { start?: Date; end?: Date; offer?: string; state?: string } = {}): Promise<TimeHeatmapCell[]> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }
    if (options.offer) where.offer_name = options.offer;
    if (options.state) where.caller_state = options.state;

    const pings = await this.prisma.inbound_ping.findMany({ where });

    // 7 days x 24 hours matrix
    const matrix = new Map<string, { pings: number; accepted: number; bids: number[] }>();

    // Initialize all cells
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        matrix.set(`${day}-${hour}`, { pings: 0, accepted: 0, bids: [] });
      }
    }

    let maxPings = 0;

    for (const p of pings) {
      const date = new Date(p.received_at);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day}-${hour}`;

      const cell = matrix.get(key)!;
      cell.pings++;
      maxPings = Math.max(maxPings, cell.pings);

      if (p.status === 'accepted') {
        cell.accepted++;
        if (p.winning_bid) cell.bids.push(p.winning_bid);
      }
    }

    const results: TimeHeatmapCell[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const cell = matrix.get(`${day}-${hour}`)!;
        const avgBid = cell.bids.length > 0 ? cell.bids.reduce((a, b) => a + b, 0) / cell.bids.length : 0;

        results.push({
          hour,
          day,
          pings: cell.pings,
          accept_rate: cell.pings > 0 ? Math.round((cell.accepted / cell.pings) * 10000) / 100 : 0,
          avg_bid: Math.round(avgBid * 100) / 100,
          intensity: maxPings > 0 ? cell.pings / maxPings : 0,
        });
      }
    }

    return results;
  }

  // ============================================
  // LATENCY FORENSICS
  // ============================================

  async getLatencyStats(options: { start?: Date; end?: Date } = {}): Promise<LatencyStats> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const responses = await this.prisma.ping_response.findMany({
      where,
      include: { ping: true },
      orderBy: { response_time_ms: 'desc' },
    });

    const latencies = responses.map(r => r.response_time_ms).filter(l => l != null) as number[];
    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    // Group by buyer
    const byBuyer = new Map<string, number[]>();
    responses.forEach(r => {
      const buyerName = r.buyer_name || 'Unknown';
      if (!byBuyer.has(buyerName)) byBuyer.set(buyerName, []);
      if (r.response_time_ms) byBuyer.get(buyerName)!.push(r.response_time_ms);
    });

    const buyerStats = [...byBuyer.entries()].map(([buyer, lats]) => {
      lats.sort((a, b) => a - b);
      return {
        buyer,
        avg_ms: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length),
        p95_ms: lats[Math.floor(lats.length * 0.95)] || 0,
      };
    }).sort((a, b) => b.avg_ms - a.avg_ms);

    // Group by state
    const byState = new Map<string, number[]>();
    responses.forEach(r => {
      const state = r.ping?.caller_state;
      if (!state) return;
      if (!byState.has(state)) byState.set(state, []);
      if (r.response_time_ms) byState.get(state)!.push(r.response_time_ms);
    });

    const stateStats = [...byState.entries()].map(([state, lats]) => ({
      state,
      avg_ms: Math.round(lats.reduce((a, b) => a + b, 0) / lats.length),
    })).sort((a, b) => b.avg_ms - a.avg_ms);

    // Slowest pings
    const slowest = responses.slice(0, 10).map(r => ({
      ping_id: r.ping_id,
      total_ms: r.response_time_ms || 0,
      buyer: r.buyer_name || 'Unknown',
      timestamp: r.received_at,
    }));

    return {
      avg_total_ms: Math.round(avg),
      p50_ms: p50,
      p95_ms: p95,
      p99_ms: p99,
      by_buyer: buyerStats.slice(0, 10),
      by_state: stateStats.slice(0, 10),
      slowest_pings: slowest,
    };
  }

  // ============================================
  // REVENUE OPTIMIZATION SUGGESTIONS
  // ============================================

  async getRevenueOpportunities(): Promise<RevenueOpportunity[]> {
    const opportunities: RevenueOpportunity[] = [];

    // Get coverage gaps
    const gaps = await this.getCoverageGaps();
    const noByerGaps = gaps.filter(g => g.gap_type === 'no_buyer');
    if (noByerGaps.length > 0) {
      const topGap = noByerGaps[0];
      opportunities.push({
        type: 'coverage',
        title: `Add buyer for ${topGap.state}`,
        description: `You have ${topGap.pings_received} pings/month from ${topGap.state} with no active buyers`,
        current_value: 0,
        potential_value: topGap.estimated_monthly_value,
        increase_pct: 100,
        confidence: 0.8,
        action: `Add a buyer that covers ${topGap.state}`,
        affected_pings_per_day: Math.round(topGap.pings_received / 30),
      });
    }

    // Low accept rate opportunities
    const lowAccept = gaps.filter(g => g.gap_type === 'low_accept' && g.pings_received > 100);
    if (lowAccept.length > 0) {
      const top = lowAccept[0];
      opportunities.push({
        type: 'coverage',
        title: `Improve ${top.state} accept rate`,
        description: `${top.state} has only ${top.accept_rate}% accept rate with ${top.pings_received} pings`,
        current_value: top.pings_received * top.accept_rate / 100 * top.avg_bid,
        potential_value: top.estimated_monthly_value,
        increase_pct: Math.round((50 - top.accept_rate) / top.accept_rate * 100),
        confidence: 0.7,
        action: `Add more buyers or increase caps for ${top.state}`,
        affected_pings_per_day: Math.round(top.pings_received / 30),
      });
    }

    // Time-based opportunities
    const timeHeatmap = await this.getTimeHeatmap();
    const lowPerformanceHours = timeHeatmap.filter(t => t.pings > 10 && t.accept_rate < 30);
    if (lowPerformanceHours.length > 0) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const worst = lowPerformanceHours.sort((a, b) => a.accept_rate - b.accept_rate)[0];
      opportunities.push({
        type: 'timing',
        title: `Improve ${days[worst.day]} ${worst.hour}:00 performance`,
        description: `Only ${worst.accept_rate}% accept rate during this hour`,
        current_value: worst.pings * worst.accept_rate / 100 * worst.avg_bid,
        potential_value: worst.pings * 0.5 * (worst.avg_bid || 30),
        increase_pct: Math.round((50 - worst.accept_rate) / worst.accept_rate * 100),
        confidence: 0.6,
        action: `Check buyer availability during ${days[worst.day]} ${worst.hour}:00`,
        affected_pings_per_day: Math.round(worst.pings / 7),
      });
    }

    // Sort by potential value
    return opportunities.sort((a, b) => (b.potential_value - b.current_value) - (a.potential_value - a.current_value));
  }

  // ============================================
  // ANOMALY DETECTION
  // ============================================

  async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = new Date();

    // Compare last hour vs previous 24-hour average
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent stats
    const recentPings = await this.prisma.inbound_ping.findMany({
      where: { received_at: { gte: oneHourAgo } },
    });

    const historicalPings = await this.prisma.inbound_ping.findMany({
      where: { received_at: { gte: oneDayAgo, lt: oneHourAgo } },
    });

    if (recentPings.length > 5 && historicalPings.length > 20) {
      // Accept rate anomaly
      const recentAcceptRate = recentPings.filter(p => p.status === 'accepted').length / recentPings.length * 100;
      const historicalAcceptRate = historicalPings.filter(p => p.status === 'accepted').length / historicalPings.length * 100;

      if (Math.abs(recentAcceptRate - historicalAcceptRate) > 15) {
        anomalies.push({
          id: `ar-${now.getTime()}`,
          detected_at: now,
          type: recentAcceptRate < historicalAcceptRate ? 'accept_rate_drop' : 'accept_rate_drop',
          severity: Math.abs(recentAcceptRate - historicalAcceptRate) > 30 ? 'high' : 'medium',
          metric_name: 'Accept Rate',
          expected_value: Math.round(historicalAcceptRate * 100) / 100,
          actual_value: Math.round(recentAcceptRate * 100) / 100,
          deviation_pct: Math.round((recentAcceptRate - historicalAcceptRate) / historicalAcceptRate * 100),
          context: `Accept rate ${recentAcceptRate < historicalAcceptRate ? 'dropped' : 'spiked'} from ${historicalAcceptRate.toFixed(1)}% to ${recentAcceptRate.toFixed(1)}%`,
          affected_entity: 'All Traffic',
          affected_entity_type: 'global',
          is_resolved: false,
          resolved_at: null,
        });
      }

      // Traffic volume anomaly
      const expectedHourlyPings = historicalPings.length / 23; // 23 hours of historical data
      if (recentPings.length < expectedHourlyPings * 0.5) {
        anomalies.push({
          id: `tv-${now.getTime()}`,
          detected_at: now,
          type: 'traffic_drop',
          severity: recentPings.length < expectedHourlyPings * 0.25 ? 'critical' : 'high',
          metric_name: 'Ping Volume',
          expected_value: Math.round(expectedHourlyPings),
          actual_value: recentPings.length,
          deviation_pct: Math.round((recentPings.length - expectedHourlyPings) / expectedHourlyPings * 100),
          context: `Traffic dropped to ${recentPings.length} pings (expected ~${Math.round(expectedHourlyPings)})`,
          affected_entity: 'All Traffic',
          affected_entity_type: 'global',
          is_resolved: false,
          resolved_at: null,
        });
      }
    }

    return anomalies;
  }

  // ============================================
  // BID DISTRIBUTION (Box Plot Data)
  // ============================================

  async getBidDistribution(options: { start?: Date; end?: Date } = {}): Promise<any[]> {
    const where: any = { bid_amount: { not: null } };
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const responses = await this.prisma.ping_response.findMany({
      where,
      select: { buyer_name: true, bid_amount: true },
    });

    const byBuyer = new Map<string, number[]>();
    responses.forEach(r => {
      if (!r.bid_amount) return;
      const buyerName = r.buyer_name || 'Unknown';
      if (!byBuyer.has(buyerName)) byBuyer.set(buyerName, []);
      byBuyer.get(buyerName)!.push(r.bid_amount);
    });

    return [...byBuyer.entries()]
      .filter(([_, bids]) => bids.length >= 3)
      .map(([buyer, bids]) => {
        bids.sort((a, b) => a - b);
        const n = bids.length;
        const q1Idx = Math.floor(n * 0.25);
        const medIdx = Math.floor(n * 0.5);
        const q3Idx = Math.floor(n * 0.75);

        return {
          buyer,
          min: bids[0],
          q1: bids[q1Idx],
          median: bids[medIdx],
          q3: bids[q3Idx],
          max: bids[n - 1],
          avg: Math.round(bids.reduce((a, b) => a + b, 0) / n * 100) / 100,
          count: n,
        };
      })
      .sort((a, b) => b.median - a.median);
  }

  // ============================================
  // PING FLOW (Publisher → Campaign → Buyer Tree)
  // ============================================

  async getPingFlow(options: { start?: Date; end?: Date } = {}): Promise<any> {
    const where: any = {};
    if (options.start || options.end) {
      where.received_at = {};
      if (options.start) where.received_at.gte = options.start;
      if (options.end) where.received_at.lte = options.end;
    }

    const pings = await this.prisma.inbound_ping.findMany({
      where,
      include: { responses: true },
      orderBy: { received_at: 'desc' },
      take: 10000,
    });

    const nodes: any[] = [];
    const edges: any[] = [];

    const publisherMap = new Map<string, { pings: number; matched: number }>();
    const campaignMap = new Map<string, { pings: number; matched: number }>();
    const buyerMap = new Map<string, { pings: number; matched: number; efficiency: number }>();

    const pubToCamp = new Map<string, Map<string, number>>();
    const campToBuyer = new Map<string, Map<string, number>>();

    let totalBids = 0;
    let totalBidValue = 0;
    let rateLimited = 0;

    for (const ping of pings) {
      const publisher = ping.traffic_source || ping.publisher_name || 'Unknown Publisher';
      const campaign = ping.offer_name || 'Unknown Campaign';
      const isAccepted = ping.status === 'accepted';

      if (!publisherMap.has(publisher)) publisherMap.set(publisher, { pings: 0, matched: 0 });
      publisherMap.get(publisher)!.pings++;
      if (isAccepted) publisherMap.get(publisher)!.matched++;

      if (!campaignMap.has(campaign)) campaignMap.set(campaign, { pings: 0, matched: 0 });
      campaignMap.get(campaign)!.pings++;
      if (isAccepted) campaignMap.get(campaign)!.matched++;

      if (!pubToCamp.has(publisher)) pubToCamp.set(publisher, new Map());
      const ptc = pubToCamp.get(publisher)!;
      ptc.set(campaign, (ptc.get(campaign) || 0) + 1);

      for (const resp of ping.responses) {
        if (resp.bid_amount && resp.bid_amount > 0) {
          totalBids++;
          totalBidValue += resp.bid_amount;
        }

        const buyer = resp.buyer_name || 'Unknown Buyer';
        if (!buyerMap.has(buyer)) buyerMap.set(buyer, { pings: 0, matched: 0, efficiency: 0 });
        buyerMap.get(buyer)!.pings++;
        if (resp.status === 'accepted') buyerMap.get(buyer)!.matched++;

        if (!campToBuyer.has(campaign)) campToBuyer.set(campaign, new Map());
        const ctb = campToBuyer.get(campaign)!;
        ctb.set(buyer, (ctb.get(buyer) || 0) + 1);
      }
    }

    const topPublishers = [...publisherMap.entries()]
      .sort((a, b) => b[1].pings - a[1].pings)
      .slice(0, 5);

    const topCampaigns = [...campaignMap.entries()]
      .sort((a, b) => b[1].pings - a[1].pings)
      .slice(0, 5);

    const topBuyers = [...buyerMap.entries()]
      .sort((a, b) => b[1].pings - a[1].pings)
      .slice(0, 5);

    for (const [name, data] of topPublishers) {
      nodes.push({ id: `pub-${name}`, type: 'publisher', name, ...data });
    }

    for (const [name, data] of topCampaigns) {
      nodes.push({ id: `camp-${name}`, type: 'campaign', name, ...data });
    }

    for (const [name, data] of topBuyers) {
      const efficiency = data.pings > 0 ? Math.round((data.matched / data.pings) * 100) : 0;
      nodes.push({ id: `buyer-${name}`, type: 'buyer', name, ...data, efficiency });
    }

    for (const [pub, camps] of pubToCamp.entries()) {
      if (!topPublishers.some(([n]) => n === pub)) continue;
      for (const [camp, count] of camps.entries()) {
        if (!topCampaigns.some(([n]) => n === camp)) continue;
        edges.push({ source: `pub-${pub}`, target: `camp-${camp}`, pings: count });
      }
    }

    for (const [camp, buyers] of campToBuyer.entries()) {
      if (!topCampaigns.some(([n]) => n === camp)) continue;
      for (const [buyer, count] of buyers.entries()) {
        if (!topBuyers.some(([n]) => n === buyer)) continue;
        edges.push({ source: `camp-${camp}`, target: `buyer-${buyer}`, pings: count });
      }
    }

    return {
      nodes,
      edges,
      stats: {
        total_pings: pings.length,
        total_bids: totalBids,
        bid_rate: pings.length > 0 ? Math.round((totalBids / pings.length) * 1000) / 10 : 0,
        avg_bid: totalBids > 0 ? Math.round((totalBidValue / totalBids) * 100) / 100 : 0,
        rate_limited: rateLimited,
      },
    };
  }
}
