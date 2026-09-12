import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface BuyerWithRelay {
  td_buyer_id: string;
  name: string;
  relay_enabled: boolean;
  relay_url?: string;
  original_ping_url?: string;
  platform?: string;
  stats?: {
    total_pings: number;
    total_accepts: number;
    total_rejects: number;
    accept_rate: number;
    avg_latency_ms: number;
    last_ping_at: Date | null;
  };
}

export interface RelayResponse {
  accepted: boolean;
  bid_amount?: number;
  rejection_reason?: string;
  raw_response: any;
  latency_ms: number;
}

@Injectable()
export class PingRelayService {
  private readonly logger = new Logger(PingRelayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackdrive: TrackDriveService,
    private readonly config: ConfigService,
  ) {}

  private getBaseUrl(): string {
    return this.config.get<string>('API_BASE_URL', 'https://api.grovlabs.com');
  }

  async listBuyersWithRelayStatus(): Promise<BuyerWithRelay[]> {
    // Get buyers from TrackDrive
    const tdResponse = await this.trackdrive.listBuyers();
    const tdBuyers = tdResponse?.buyers || [];

    // Get relay configs from our DB
    const relayConfigs = await this.prisma.buyer_relay_config.findMany();
    const configMap = new Map(relayConfigs.map(c => [c.td_buyer_id, c]));

    const baseUrl = this.getBaseUrl();

    return tdBuyers.map((buyer: any) => {
      const config = configMap.get(String(buyer.id));
      return {
        td_buyer_id: String(buyer.id),
        name: buyer.name || buyer.company_name || `Buyer ${buyer.id}`,
        relay_enabled: config?.relay_enabled || false,
        relay_url: config ? `${baseUrl}/ping-relay/relay/${config.relay_key}` : undefined,
        original_ping_url: config?.original_ping_url,
        platform: config?.platform || 'unknown',
        stats: config ? {
          total_pings: config.total_pings,
          total_accepts: config.total_accepts,
          total_rejects: config.total_rejects,
          accept_rate: config.total_pings > 0
            ? Math.round((config.total_accepts / config.total_pings) * 100)
            : 0,
          avg_latency_ms: config.avg_latency_ms,
          last_ping_at: config.last_ping_at,
        } : undefined,
      };
    });
  }

  async getBuyerDetails(buyerId: string): Promise<{
    td_buyer_id: string;
    name: string;
    ping_url: string | null;
    platform: string;
  }> {
    const buyer = await this.trackdrive.getBuyer(buyerId);
    const buyerData = buyer?.buyer || buyer;

    this.logger.debug(`Buyer ${buyerId} data: ${JSON.stringify(buyerData)}`);

    const pingUrl = buyerData?.ping_url || buyerData?.pingUrl || buyerData?.ping_post_url || buyerData?.inbound_ping_url || null;
    let platform = 'custom';

    if (pingUrl) {
      if (pingUrl.includes('trackdrive.com')) platform = 'trackdrive';
      else if (pingUrl.includes('callgrid.com')) platform = 'callgrid';
      else if (pingUrl.includes('retreaver.com')) platform = 'retreaver';
      else if (pingUrl.includes('ringba.com')) platform = 'ringba';
    }

    return {
      td_buyer_id: String(buyerData?.id || buyerId),
      name: buyerData?.name || `Buyer ${buyerId}`,
      ping_url: pingUrl,
      platform,
    };
  }

  async enableRelay(
    tdBuyerId: string,
    platform: string,
    originalPingUrl: string,
    tdConversionId: string,
  ): Promise<{ success: boolean; relay_url: string; message: string }> {
    const baseUrl = this.getBaseUrl();

    // Get buyer info from TrackDrive
    const buyer = await this.trackdrive.getBuyer(tdBuyerId);
    const buyerName = buyer?.buyer?.name || buyer?.name || `Buyer ${tdBuyerId}`;

    // Create or update relay config
    let config = await this.prisma.buyer_relay_config.findUnique({
      where: { td_buyer_id: tdBuyerId },
    });

    if (!config) {
      config = await this.prisma.buyer_relay_config.create({
        data: {
          td_buyer_id: tdBuyerId,
          buyer_name: buyerName,
          platform,
          original_ping_url: originalPingUrl,
          td_conversion_id: tdConversionId,
          relay_enabled: true,
        },
      });
    } else {
      config = await this.prisma.buyer_relay_config.update({
        where: { td_buyer_id: tdBuyerId },
        data: {
          platform,
          original_ping_url: originalPingUrl,
          td_conversion_id: tdConversionId,
          relay_enabled: true,
        },
      });
    }

    const relayUrl = `${baseUrl}/ping-relay/relay/${config.relay_key}`;

    // Update the EXISTING TrackDrive buyer_conversion to use our relay URL
    try {
      await this.trackdrive.updateBuyerConversion(tdConversionId, {
        remote_url: relayUrl,
      });
      this.logger.log(`Enabled relay for buyer ${tdBuyerId}, updated conversion ${tdConversionId}, URL: ${relayUrl}`);
    } catch (err: any) {
      this.logger.error(`Failed to update TrackDrive buyer conversion ${tdConversionId}: ${err.message}`);
      return {
        success: true,
        relay_url: relayUrl,
        message: `Relay configured but failed to update TrackDrive: ${err.message}`,
      };
    }

    return {
      success: true,
      relay_url: relayUrl,
      message: 'Relay enabled and TrackDrive updated successfully',
    };
  }

  async disableRelay(tdBuyerId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.prisma.buyer_relay_config.findUnique({
      where: { td_buyer_id: tdBuyerId },
    });

    if (!config) {
      return { success: false, message: 'Relay config not found' };
    }

    // Restore original URL in the TrackDrive buyer conversion
    if (config.td_conversion_id && config.original_ping_url) {
      try {
        await this.trackdrive.updateBuyerConversion(config.td_conversion_id, {
          remote_url: config.original_ping_url,
        });
        this.logger.log(`Restored original URL for TrackDrive conversion ${config.td_conversion_id}`);
      } catch (err: any) {
        this.logger.error(`Failed to restore TrackDrive conversion ${config.td_conversion_id}: ${err.message}`);
        return {
          success: false,
          message: `Failed to restore original URL in TrackDrive: ${err.message}`,
        };
      }
    }

    // Disable in our config (keep the record for history)
    await this.prisma.buyer_relay_config.update({
      where: { td_buyer_id: tdBuyerId },
      data: { relay_enabled: false },
    });

    this.logger.log(`Disabled relay for buyer ${tdBuyerId}`);
    return { success: true, message: 'Relay disabled and original URL restored' };
  }

  // Cache for relay configs to avoid DB lookup on every ping
  private configCache = new Map<string, { config: any; expiry: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute

  private async getConfigCached(relayKey: string): Promise<any> {
    const cached = this.configCache.get(relayKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.config;
    }
    const config = await this.prisma.buyer_relay_config.findUnique({
      where: { relay_key: relayKey },
    });
    if (config) {
      this.configCache.set(relayKey, { config, expiry: Date.now() + this.CACHE_TTL });
    }
    return config;
  }

  async handleRelayPing(
    relayKey: string,
    payload: any,
    headers: Record<string, string>,
  ): Promise<any> {
    const startTime = Date.now();

    // Find relay config (cached)
    const config = await this.getConfigCached(relayKey);

    if (!config || !config.relay_enabled) {
      throw new Error('Relay not found or disabled');
    }

    // FORWARD FIRST - this is the critical path for latency
    let response: RelayResponse;
    try {
      response = await this.forwardPing(config, payload, headers);
    } catch (err: any) {
      const latency = Date.now() - startTime;

      // Log in background - don't block response
      this.logFailedPing(config, payload, err.message, latency).catch(e =>
        this.logger.error(`Failed to log ping: ${e.message}`)
      );

      // Return error response instead of throwing
      return { error: err.message, latency_ms: latency };
    }

    const latency = Date.now() - startTime;

    // Log everything in background - don't block response
    this.logSuccessfulPing(config, payload, response, latency).catch(e =>
      this.logger.error(`Failed to log ping: ${e.message}`)
    );

    // Return the raw response to TrackDrive immediately
    return response.raw_response;
  }

  private async logFailedPing(config: any, payload: any, errorMessage: string, latency: number): Promise<void> {
    const ping = await this.prisma.inbound_ping.create({
      data: {
        caller_phone: payload.caller_id || payload.caller_phone || payload.phone,
        caller_state: (payload.state || payload.caller_state || '').toUpperCase().slice(0, 2),
        caller_zip: (payload.zip || payload.zipcode || payload.caller_zip || '').slice(0, 5),
        caller_city: payload.city || payload.caller_city,
        traffic_source: payload.traffic_source || payload.publisher,
        offer_name: payload.offer || payload.offer_name || payload.campaign,
        raw_payload: payload,
        status: 'failed',
        processing_time_ms: latency,
      },
    });

    await this.prisma.ping_response.create({
      data: {
        ping_id: ping.id,
        buyer_id: config.td_buyer_id,
        buyer_name: config.buyer_name,
        status: 'error',
        error_message: errorMessage,
        response_time_ms: latency,
      },
    });

    await this.updateConfigStats(config.id, latency, false, false);
  }

  private async logSuccessfulPing(config: any, payload: any, response: RelayResponse, latency: number): Promise<void> {
    const ping = await this.prisma.inbound_ping.create({
      data: {
        caller_phone: payload.caller_id || payload.caller_phone || payload.phone,
        caller_state: (payload.state || payload.caller_state || '').toUpperCase().slice(0, 2),
        caller_zip: (payload.zip || payload.zipcode || payload.caller_zip || '').slice(0, 5),
        caller_city: payload.city || payload.caller_city,
        traffic_source: payload.traffic_source || payload.publisher,
        offer_name: payload.offer || payload.offer_name || payload.campaign,
        raw_payload: payload,
        status: response.accepted ? 'accepted' : 'rejected',
        winning_buyer_id: response.accepted ? config.td_buyer_id : null,
        winning_buyer_name: response.accepted ? config.buyer_name : null,
        winning_bid: response.bid_amount,
        processing_time_ms: latency,
        total_buyers_pinged: 1,
        total_accepts: response.accepted ? 1 : 0,
        total_rejects: response.accepted ? 0 : 1,
      },
    });

    await this.prisma.ping_response.create({
      data: {
        ping_id: ping.id,
        buyer_id: config.td_buyer_id,
        buyer_name: config.buyer_name,
        status: response.accepted ? 'accepted' : 'rejected',
        bid_amount: response.bid_amount,
        rejection_reason: response.rejection_reason,
        response_time_ms: response.latency_ms,
        raw_response: response.raw_response,
        is_winner: response.accepted,
      },
    });

    await this.updateConfigStats(config.id, response.latency_ms, response.accepted, true);
  }

  private async forwardPing(
    config: any,
    payload: any,
    headers: Record<string, string>,
  ): Promise<RelayResponse> {
    const startTime = Date.now();
    let url = config.original_ping_url;

    // Build request based on platform
    const method = config.method || 'POST';
    let requestBody: any = undefined;
    let requestUrl = url;

    if (config.platform === 'retreaver') {
      // Retreaver uses GET with query params
      requestUrl = this.buildUrlWithParams(url, payload);
    } else if (config.platform === 'ringba') {
      // Ringba typically uses POST with JSON
      requestBody = payload;
    } else if (config.platform === 'callgrid') {
      // CallGrid uses POST
      requestBody = payload;
    } else if (config.platform === 'trackdrive') {
      // TrackDrive ping format
      requestBody = payload;
    } else {
      // Custom/generic - pass through
      requestBody = method === 'POST' ? payload : undefined;
      if (method === 'GET') {
        requestUrl = this.buildUrlWithParams(url, payload);
      }
    }

    // Forward headers (but strip some internal ones)
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add any custom headers from config
    if (config.headers) {
      Object.assign(forwardHeaders, config.headers);
    }

    try {
      const response = await axios({
        method: method as any,
        url: requestUrl,
        data: requestBody,
        headers: forwardHeaders,
        timeout: 10000, // 10 second timeout
      });

      const latency = Date.now() - startTime;
      const parsed = this.parseResponse(config.platform, response.data, config);

      return {
        accepted: parsed.accepted,
        bid_amount: parsed.bid_amount,
        rejection_reason: parsed.rejection_reason,
        raw_response: response.data,
        latency_ms: latency,
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;

      // Check if it's an axios error with response
      if (err.response) {
        return {
          accepted: false,
          rejection_reason: `HTTP ${err.response.status}: ${err.response.statusText}`,
          raw_response: err.response.data,
          latency_ms: latency,
        };
      }

      throw new Error(`Failed to forward ping: ${err.message}`);
    }
  }

  private buildUrlWithParams(baseUrl: string, payload: any): string {
    const url = new URL(baseUrl);

    // Replace placeholders like [caller_id], [state], etc.
    let urlStr = baseUrl;
    const placeholders: Record<string, string> = {
      '[caller_id]': payload.caller_id || payload.caller_phone || payload.phone || '',
      '[caller_id_short]': (payload.caller_id || payload.caller_phone || payload.phone || '').replace(/\D/g, ''),
      '[state]': payload.state || payload.caller_state || '',
      '[zip]': payload.zip || payload.zipcode || payload.caller_zip || '',
      '[zipcode]': payload.zip || payload.zipcode || payload.caller_zip || '',
      '[city]': payload.city || payload.caller_city || '',
      '[offer]': payload.offer || payload.offer_name || '',
      '[campaign]': payload.campaign || payload.offer || '',
    };

    for (const [placeholder, value] of Object.entries(placeholders)) {
      urlStr = urlStr.replace(placeholder, encodeURIComponent(value));
    }

    return urlStr;
  }

  private parseResponse(
    platform: string,
    data: any,
    config: any,
  ): { accepted: boolean; bid_amount?: number; rejection_reason?: string } {
    try {
      if (platform === 'trackdrive') {
        // TrackDrive format: { success: true, buyers: [...] } or { accepted: true }
        const accepted = data.success === true || data.accepted === true ||
                        (data.buyers && data.buyers.length > 0);
        const buyer = data.buyers?.[0];
        return {
          accepted,
          bid_amount: buyer?.payout || buyer?.bid || data.payout || data.bid,
          rejection_reason: !accepted ? (data.reason || data.message || 'rejected') : undefined,
        };
      }

      if (platform === 'ringba') {
        // Ringba format: { accepted: true/false, payout: X } or { error: { message: "..." } }
        if (data.error) {
          return {
            accepted: false,
            rejection_reason: data.error.message || `Error ${data.error.code}`,
          };
        }
        return {
          accepted: data.accepted === true || data.status === 'accepted',
          bid_amount: data.payout || data.bid || data.revenue,
          rejection_reason: data.reason || data.rejection_reason || data.message,
        };
      }

      if (platform === 'retreaver') {
        // Retreaver format varies, usually { rtb: { accepted: true } }
        const rtb = data.rtb || data;
        return {
          accepted: rtb.accepted === true || rtb.status === 'accepted',
          bid_amount: rtb.payout || rtb.bid,
          rejection_reason: rtb.reason,
        };
      }

      if (platform === 'callgrid') {
        // CallGrid format: { bid: true/false, amount: X }
        return {
          accepted: data.bid === true || data.accepted === true,
          bid_amount: data.amount || data.payout || data.bid_amount,
          rejection_reason: data.rejection_reason || data.reason,
        };
      }

      // Generic/custom - use config field mappings or defaults
      let accepted = false;
      if (config.accept_field) {
        accepted = this.getNestedValue(data, config.accept_field) === true;
      } else {
        accepted = data.accepted === true || data.success === true || data.bid === true;
      }

      let bidAmount: number | undefined;
      if (config.bid_field) {
        bidAmount = parseFloat(this.getNestedValue(data, config.bid_field)) || undefined;
      } else {
        bidAmount = data.payout || data.bid || data.amount || data.revenue;
      }

      let rejectReason: string | undefined;
      if (!accepted && config.reject_reason_field) {
        rejectReason = this.getNestedValue(data, config.reject_reason_field);
      } else if (!accepted) {
        rejectReason = data.reason || data.rejection_reason || data.message;
      }

      return { accepted, bid_amount: bidAmount, rejection_reason: rejectReason };
    } catch {
      // If parsing fails, assume rejected
      return { accepted: false, rejection_reason: 'Failed to parse response' };
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private async updateConfigStats(
    configId: string,
    latencyMs: number,
    accepted: boolean,
    success: boolean,
  ): Promise<void> {
    const config = await this.prisma.buyer_relay_config.findUnique({
      where: { id: configId },
    });

    if (!config) return;

    const newTotal = config.total_pings + 1;
    const newAccepts = config.total_accepts + (accepted ? 1 : 0);
    const newRejects = config.total_rejects + (!accepted && success ? 1 : 0);

    // Running average for latency
    const newAvgLatency = config.total_pings > 0
      ? (config.avg_latency_ms * config.total_pings + latencyMs) / newTotal
      : latencyMs;

    await this.prisma.buyer_relay_config.update({
      where: { id: configId },
      data: {
        total_pings: newTotal,
        total_accepts: newAccepts,
        total_rejects: newRejects,
        avg_latency_ms: newAvgLatency,
        last_ping_at: new Date(),
      },
    });
  }

  async getRelayStats(): Promise<{
    total_relays: number;
    active_relays: number;
    total_pings: number;
    total_accepts: number;
    accept_rate: number;
    avg_latency_ms: number;
  }> {
    const configs = await this.prisma.buyer_relay_config.findMany();

    const activeCount = configs.filter(c => c.relay_enabled).length;
    const totalPings = configs.reduce((sum, c) => sum + c.total_pings, 0);
    const totalAccepts = configs.reduce((sum, c) => sum + c.total_accepts, 0);
    const avgLatency = configs.length > 0
      ? configs.reduce((sum, c) => sum + c.avg_latency_ms * c.total_pings, 0) / (totalPings || 1)
      : 0;

    return {
      total_relays: configs.length,
      active_relays: activeCount,
      total_pings: totalPings,
      total_accepts: totalAccepts,
      accept_rate: totalPings > 0 ? Math.round((totalAccepts / totalPings) * 100) : 0,
      avg_latency_ms: Math.round(avgLatency),
    };
  }
}
