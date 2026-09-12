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
  bid_floor?: number | null;
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

interface PayoutConfig {
  offer_id: string;
  offer_name: string;
  payout_type: 'usd' | 'buyer_conversion_percent';
  payout: number;
  revenue_percentage: number;
}

@Injectable()
export class PingRelayService {
  private readonly logger = new Logger(PingRelayService.name);
  private payoutConfigCache: Map<string, PayoutConfig> = new Map();
  private payoutCacheLastRefresh: Date | null = null;
  private readonly PAYOUT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly DUPLICATE_WINDOW_MINUTES = 30; // Block same caller+buyer for 30 mins

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackdrive: TrackDriveService,
    private readonly config: ConfigService,
  ) {}

  private async refreshPayoutConfigs(): Promise<void> {
    if (
      this.payoutCacheLastRefresh &&
      Date.now() - this.payoutCacheLastRefresh.getTime() < this.PAYOUT_CACHE_TTL_MS
    ) {
      return;
    }

    try {
      const response = await this.trackdrive.listOfferConversions({ per_page: 200 });
      const conversions = response?.offer_conversions || response || [];

      // Also fetch offers to get offer names
      const offersResponse = await this.trackdrive.listOffers({ per_page: 200 });
      const offers = offersResponse?.offers || [];
      const offerNameMap = new Map<string, string>();
      for (const o of offers) {
        offerNameMap.set(String(o.id), String(o.name || o.title || ''));
      }

      this.payoutConfigCache.clear();
      for (const conv of conversions) {
        if (conv.offer_id) {
          const offerId = String(conv.offer_id);
          const offerName = offerNameMap.get(offerId) || '';
          this.payoutConfigCache.set(offerId, {
            offer_id: offerId,
            offer_name: offerName,
            payout_type: conv.payout_type || 'usd',
            payout: Number(conv.payout) || 0,
            revenue_percentage: Number(conv.revenue_percentage) || 0,
          });
          // Also index by name for lookup
          if (offerName) {
            this.payoutConfigCache.set(offerName.toLowerCase(), {
              offer_id: offerId,
              offer_name: offerName,
              payout_type: conv.payout_type || 'usd',
              payout: Number(conv.payout) || 0,
              revenue_percentage: Number(conv.revenue_percentage) || 0,
            });
          }
        }
      }

      this.payoutCacheLastRefresh = new Date();
      this.logger.log(`Refreshed payout configs: ${this.payoutConfigCache.size} entries`);
    } catch (err: any) {
      this.logger.warn(`Failed to refresh payout configs: ${err.message}`);
    }
  }

  private calculatePublisherPayout(offerName: string, winningBid: number): { payout: number; margin: number } | null {
    const searchName = offerName.toLowerCase().trim();

    // Try exact match first
    let config = this.payoutConfigCache.get(searchName);

    // Try "name - name" format (TrackDrive often uses this)
    if (!config) {
      config = this.payoutConfigCache.get(`${searchName} - ${searchName}`);
    }

    // Try partial match - find any key that starts with the search name
    if (!config) {
      for (const [key, value] of this.payoutConfigCache.entries()) {
        if (key.startsWith(searchName) || key.includes(searchName)) {
          config = value;
          break;
        }
      }
    }

    if (!config) return null;

    let payout: number;
    if (config.payout_type === 'buyer_conversion_percent') {
      payout = winningBid * (config.revenue_percentage / 100);
    } else {
      payout = config.payout;
    }

    return {
      payout: Math.round(payout * 100) / 100,
      margin: Math.round((winningBid - payout) * 100) / 100,
    };
  }

  async getPayoutConfigs(): Promise<{ configs: any[]; cacheAge: number | null }> {
    await this.refreshPayoutConfigs();
    const configs: any[] = [];
    this.payoutConfigCache.forEach((value, key) => {
      configs.push({ key, ...value });
    });
    return {
      configs,
      cacheAge: this.payoutCacheLastRefresh
        ? Date.now() - this.payoutCacheLastRefresh.getTime()
        : null,
    };
  }

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
        bid_floor: config?.bid_floor ?? null,
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

    // Auto-fetch the original URL from TrackDrive conversion (more reliable than user input)
    let actualOriginalUrl = originalPingUrl;
    try {
      const conversion = await this.trackdrive.getBuyerConversion(tdConversionId);
      const conversionData = conversion?.buyer_conversion || conversion;
      if (conversionData?.webhook_remote_url && !conversionData.webhook_remote_url.includes('api.grovlabs.com')) {
        actualOriginalUrl = conversionData.webhook_remote_url;
        this.logger.log(`Fetched original URL from TrackDrive: ${actualOriginalUrl}`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not fetch conversion, using provided URL: ${err.message}`);
    }

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
          original_ping_url: actualOriginalUrl,
          td_conversion_id: tdConversionId,
          relay_enabled: true,
        },
      });
    } else {
      config = await this.prisma.buyer_relay_config.update({
        where: { td_buyer_id: tdBuyerId },
        data: {
          platform,
          original_ping_url: actualOriginalUrl,
          td_conversion_id: tdConversionId,
          relay_enabled: true,
        },
      });
    }

    // Build relay URL with TrackDrive tokens for full data capture
    const relayUrl = `${baseUrl}/ping-relay/relay/${config.relay_key}?` +
      `CALLER_ID=[caller_id]&CALLER_STATE=[state]&ZIP_CODE=[zip]&` +
      `OFFER=[offer_name]&SOURCE=[traffic_source_name]&PUBLISHER=[publisher_name]`;

    // Update the EXISTING TrackDrive buyer_conversion to use our relay URL
    try {
      await this.trackdrive.updateBuyerConversion(tdConversionId, {
        webhook_remote_url: relayUrl,
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
          webhook_remote_url: config.original_ping_url,
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

  async setBidFloor(tdBuyerId: string, bidFloor: number | null): Promise<{ success: boolean; message: string; bid_floor: number | null }> {
    const config = await this.prisma.buyer_relay_config.findUnique({
      where: { td_buyer_id: tdBuyerId },
    });

    if (!config) {
      return { success: false, message: 'Relay config not found', bid_floor: null };
    }

    await this.prisma.buyer_relay_config.update({
      where: { td_buyer_id: tdBuyerId },
      data: { bid_floor: bidFloor },
    });

    // Clear cache so new floor takes effect immediately
    this.configCache.clear();

    this.logger.log(`Set bid floor for ${config.buyer_name}: $${bidFloor ?? 'none'}`);

    return {
      success: true,
      message: bidFloor ? `Bid floor set to $${bidFloor}` : 'Bid floor removed',
      bid_floor: bidFloor,
    };
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

  /**
   * Check if this caller+buyer combo was seen recently
   * Queries ping_response table since it tracks all pings sent to buyers (not just accepted)
   */
  private async checkDuplicate(callerPhone: string, buyerId: string): Promise<{ isDuplicate: boolean; originalPingId?: string }> {
    if (!callerPhone) return { isDuplicate: false };

    const windowStart = new Date(Date.now() - this.DUPLICATE_WINDOW_MINUTES * 60 * 1000);

    // Check ping_response for any ping sent to this buyer for this caller
    const existing = await this.prisma.ping_response.findFirst({
      where: {
        buyer_id: buyerId,
        ping: {
          caller_phone: callerPhone,
          received_at: { gte: windowStart },
        },
      },
      orderBy: { ping: { received_at: 'desc' } },
      select: { ping_id: true },
    });

    return {
      isDuplicate: !!existing,
      originalPingId: existing?.ping_id,
    };
  }

  private isValidUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  async handleRelayPing(
    relayKey: string,
    payload: any,
    headers: Record<string, string>,
  ): Promise<any> {
    const startTime = Date.now();

    // Validate relay key format (must be UUID)
    if (!this.isValidUUID(relayKey)) {
      throw new Error(`Invalid relay key format: ${relayKey}`);
    }

    // Find relay config (cached)
    const config = await this.getConfigCached(relayKey);

    if (!config || !config.relay_enabled) {
      this.logger.warn(`Relay lookup failed: key=${relayKey}, found=${!!config}, enabled=${config?.relay_enabled}`);
      throw new Error(`Relay not found or disabled: ${relayKey}`);
    }

    // Extract caller ID for duplicate check
    const callerPhone = payload.CALLER_ID || payload.caller_id || payload.caller_phone || payload.phone || '';

    // Check for duplicate before forwarding
    const dupCheck = await this.checkDuplicate(callerPhone, config.td_buyer_id);
    if (dupCheck.isDuplicate) {
      const latency = Date.now() - startTime;
      this.logger.debug(`Duplicate blocked: ${callerPhone} -> ${config.buyer_name} (original: ${dupCheck.originalPingId})`);

      // Log as duplicate ping
      this.logDuplicatePing(config, payload, dupCheck.originalPingId!, latency).catch(e =>
        this.logger.error(`Failed to log duplicate: ${e.message}`)
      );

      // Return rejection to TrackDrive
      return {
        accepted: false,
        rejected: true,
        reason: 'Duplicate caller',
        duplicate_of: dupCheck.originalPingId,
      };
    }

    // FORWARD - this is the critical path for latency
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

    // Check bid floor - reject if bid is below minimum
    if (response.accepted && config.bid_floor && response.bid_amount) {
      if (response.bid_amount < config.bid_floor) {
        this.logger.debug(`Bid $${response.bid_amount} below floor $${config.bid_floor} for ${config.buyer_name}`);
        response = {
          ...response,
          accepted: false,
          rejection_reason: `Bid below floor ($${response.bid_amount} < $${config.bid_floor})`,
          raw_response: {
            accepted: false,
            rejected: true,
            reason: `Bid below minimum ($${config.bid_floor})`,
            original_bid: response.bid_amount,
          },
        };
      }
    }

    // Log everything in background - don't block response
    this.logSuccessfulPing(config, payload, response, latency).catch(e =>
      this.logger.error(`Failed to log ping: ${e.message}`)
    );

    // Return the raw response to TrackDrive immediately
    return response.raw_response;
  }

  private async logFailedPing(config: any, payload: any, errorMessage: string, latency: number): Promise<void> {
    // Handle both TrackDrive uppercase and lowercase formats
    const callerId = payload.CALLER_ID || payload.caller_id || payload.caller_phone || payload.phone;
    const state = payload.CALLER_STATE || payload.state || payload.caller_state || '';
    const zip = payload.ZIP_CODE || payload.zip || payload.zipcode || payload.caller_zip || '';
    const city = payload.CALLER_CITY || payload.city || payload.caller_city;
    const offer = payload.OFFER || payload.offer || payload.offer_name || payload.campaign;
    const source = payload.SOURCE || payload.PUBLISHER || payload.traffic_source || payload.publisher;

    const ping = await this.prisma.inbound_ping.create({
      data: {
        caller_phone: callerId,
        caller_state: state.toUpperCase().slice(0, 2),
        caller_zip: zip.slice(0, 5),
        caller_city: city,
        traffic_source: source,
        offer_name: offer,
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

  private async logDuplicatePing(config: any, payload: any, originalPingId: string, latency: number): Promise<void> {
    const callerId = payload.CALLER_ID || payload.caller_id || payload.caller_phone || payload.phone;
    const state = payload.CALLER_STATE || payload.state || payload.caller_state || '';
    const zip = payload.ZIP_CODE || payload.zip || payload.zipcode || payload.caller_zip || '';
    const city = payload.CALLER_CITY || payload.city || payload.caller_city;
    const offer = payload.OFFER || payload.offer || payload.offer_name || payload.campaign;
    const source = payload.SOURCE || payload.PUBLISHER || payload.traffic_source || payload.publisher;

    await this.prisma.inbound_ping.create({
      data: {
        caller_phone: callerId,
        caller_state: state.toUpperCase().slice(0, 2),
        caller_zip: zip.slice(0, 5),
        caller_city: city,
        traffic_source: source,
        offer_name: offer,
        raw_payload: payload,
        status: 'rejected',
        is_duplicate: true,
        duplicate_of_id: originalPingId,
        winning_buyer_id: config.td_buyer_id,
        winning_buyer_name: config.buyer_name,
        processing_time_ms: latency,
        total_buyers_pinged: 0, // Not forwarded
        total_accepts: 0,
        total_rejects: 1,
      },
    });
  }

  private async logSuccessfulPing(config: any, payload: any, response: RelayResponse, latency: number): Promise<void> {
    // Handle both TrackDrive uppercase and lowercase formats
    const callerId = payload.CALLER_ID || payload.caller_id || payload.caller_phone || payload.phone;
    const state = payload.CALLER_STATE || payload.state || payload.caller_state || '';
    const zip = payload.ZIP_CODE || payload.zip || payload.zipcode || payload.caller_zip || '';
    const city = payload.CALLER_CITY || payload.city || payload.caller_city;
    const offer = payload.OFFER || payload.offer || payload.offer_name || payload.campaign;
    const source = payload.SOURCE || payload.PUBLISHER || payload.traffic_source || payload.publisher;

    // Calculate publisher payout if bid was accepted
    let publisherPayout: number | null = null;
    let margin: number | null = null;

    this.logger.debug(`logSuccessfulPing: offer=${offer}, accepted=${response.accepted}, bid_amount=${response.bid_amount}`);

    if (response.accepted && response.bid_amount && offer) {
      await this.refreshPayoutConfigs();
      const payoutCalc = this.calculatePublisherPayout(offer, response.bid_amount);
      if (payoutCalc) {
        publisherPayout = payoutCalc.payout;
        margin = payoutCalc.margin;
        this.logger.log(`Payout calc for ${offer}: bid=$${response.bid_amount}, payout=$${publisherPayout}, margin=$${margin}`);
      } else {
        this.logger.warn(`No payout config found for offer: ${offer}`);
      }
    }

    const ping = await this.prisma.inbound_ping.create({
      data: {
        caller_phone: callerId,
        caller_state: state.toUpperCase().slice(0, 2),
        caller_zip: zip.slice(0, 5),
        caller_city: city,
        traffic_source: source,
        offer_name: offer,
        raw_payload: payload,
        status: response.accepted ? 'accepted' : 'rejected',
        winning_buyer_id: response.accepted ? config.td_buyer_id : null,
        winning_buyer_name: response.accepted ? config.buyer_name : null,
        winning_bid: response.bid_amount,
        publisher_payout: publisherPayout,
        margin: margin,
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

    // Detect method from config or URL pattern
    // URLs with placeholders like [caller_id] typically use GET
    const hasPlaceholders = url.includes('[caller_id]') || url.includes('[state]') || url.includes('[zip]');
    const method = config.method || (hasPlaceholders ? 'GET' : 'POST');

    this.logger.debug(`Forwarding ping to ${url}, method=${method}, payload=${JSON.stringify(payload)}`);

    let requestBody: any = undefined;
    let requestUrl = url;

    if (method === 'GET' || config.platform === 'retreaver' || hasPlaceholders) {
      // GET request - replace placeholders in URL
      requestUrl = this.buildUrlWithParams(url, payload);
      requestBody = undefined;
    } else if (config.platform === 'ringba') {
      requestBody = payload;
    } else if (config.platform === 'callgrid') {
      requestBody = payload;
    } else if (config.platform === 'trackdrive') {
      requestBody = payload;
    } else {
      requestBody = payload;
    }

    this.logger.debug(`Final request: ${method} ${requestUrl}`);

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

      // Debug: log raw response from buyer
      this.logger.debug(`[${config.platform}] Raw response: ${JSON.stringify(response.data).substring(0, 500)}`);

      const parsed = this.parseResponse(config.platform, response.data, config);

      this.logger.debug(`[${config.platform}] Parsed: accepted=${parsed.accepted}, bid=${parsed.bid_amount}, reason=${parsed.rejection_reason}`);

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
    // Replace placeholders like [caller_id], [state], etc.
    // TrackDrive sends CALLER_ID, ZIP_CODE, CALLER_STATE (uppercase)
    let urlStr = baseUrl;

    const callerId = payload.CALLER_ID || payload.caller_id || payload.caller_phone || payload.phone || '';
    const state = payload.CALLER_STATE || payload.state || payload.caller_state || '';
    const zip = payload.ZIP_CODE || payload.zip || payload.zipcode || payload.caller_zip || '';
    const city = payload.CALLER_CITY || payload.city || payload.caller_city || '';

    const placeholders: Record<string, string> = {
      '[caller_id]': callerId,
      '[caller_id_short]': callerId.replace(/\D/g, ''),
      '[state]': state,
      '[zip]': zip,
      '[zipcode]': zip,
      '[city]': city,
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
        // CallGrid format:
        // Success: { code: 1000, dynamicBid: "29.92", ... }
        // Reject: { code: 4004/4008, message: "..." }
        const isAccepted = data.code === 1000 || data.bid === true || data.accepted === true;
        const bidAmount = parseFloat(data.dynamicBid) || data.amount || data.payout || data.bid_amount;
        return {
          accepted: isAccepted,
          bid_amount: isAccepted && bidAmount ? bidAmount : undefined,
          rejection_reason: !isAccepted ? (data.message || data.rejection_reason || data.reason) : undefined,
        };
      }

      // Check for Moja/RTB style response with eligible_routes
      if (data.eligible_routes !== undefined) {
        const routes = data.eligible_routes || [];
        if (routes.length === 0) {
          return {
            accepted: false,
            rejection_reason: 'No eligible routes',
          };
        }
        const topRoute = routes[0];
        return {
          accepted: true,
          bid_amount: topRoute.payout || topRoute.revenue || topRoute.bid,
          rejection_reason: undefined,
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
