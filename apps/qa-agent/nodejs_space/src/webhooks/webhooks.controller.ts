import { Controller, Post, Get, Body, Headers, Query, Logger, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CallsService } from '../calls/calls.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { CallGridService } from '../trackdrive/callgrid.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NtfyService } from '../ntfy/ntfy.service.js';
import { NonConversionQaService } from '../non-conversion-qa/non-conversion-qa.service.js';
import { DiscordService } from '../discord/discord.service.js';
import { Request } from 'express';

/** "+13125550147" / "3125550147" -> "(312) 555-0147"; anything else as-is, empty -> "Unknown". */
const fmtPhone = (raw: any): string => {
  const d = String(raw || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(raw || 'Unknown');
};

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  /** Calls whose real-time QA already started (CallGrid sends CALL_ENDED + RECORDING_COMPLETED). */
  private readonly realtimeStarted = new Map<string, number>();
  /** Calls we already sent the ntfy live-call alert for. */
  private readonly liveAlerted = new Map<string, number>();

  /** True the first time a key is seen within 24h (and records it); prunes old keys. */
  private firstTime(seen: Map<string, number>, key: string): boolean {
    const now = Date.now();
    for (const [k, t] of seen) if (now - t > 86400_000) seen.delete(k);
    if (seen.has(key)) return false;
    seen.set(key, now);
    return true;
  }

  constructor(
    private readonly callsService: CallsService,
    private readonly trackdrive: TrackDriveService,
    private readonly prisma: PrismaService,
    private readonly ntfy: NtfyService,
    private readonly nonConversionQa: NonConversionQaService,
    private readonly discord: DiscordService,
    private readonly callgrid: CallGridService,
  ) {}

  /**
   * CallGrid call webhook (TrackDrive replacement). Set up in CallGrid as a CALL webhook on
   * CALL_ENDED and RECORDING_COMPLETED, POST JSON {"CallId": "[[tag:CallId]]"} to
   * /webhooks/callgrid?key=CALLGRID_WEBHOOK_KEY. We fetch the call from the CallGrid API and run it
   * through the same pipeline as a TrackDrive webhook (QA, live alert, ping link).
   * Safe to receive twice: a call is only analyzed once; a call skipped for "no recording" at
   * CALL_ENDED is picked up again when RECORDING_COMPLETED arrives.
   */
  @Post('callgrid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive CallGrid call webhooks' })
  async handleCallgridWebhook(@Req() req: Request, @Body() body: any, @Query() query: Record<string, string>) {
    const key = process.env.CALLGRID_WEBHOOK_KEY;
    if (key && query?.key !== key) return { status: 'ignored', reason: 'bad key' };
    const cgId = String(body?.CallId || body?.callId || body?.id || query?.CallId || '').trim();
    if (!cgId || /^\[\[/.test(cgId)) return { status: 'ignored', reason: 'no CallId' };
    if (!this.callgrid.enabled()) return { status: 'ignored', reason: 'CALLGRID_API_KEY not set' };
    try {
      const call = await this.callgrid.getCall(cgId);
      if (!call?.id) return { status: 'ignored', reason: 'call not found in CallGrid' };
      const payload = await this.callgrid.toTrackdrivePayload(call);
      return this.processTrackdriveWebhook(req, {}, payload);
    } catch (e: any) {
      this.logger.error(`CallGrid webhook ${cgId}: ${e.message}`);
      return { status: 'error', message: 'Failed to load call from CallGrid' };
    }
  }

  @Get('trackdrive')
  @ApiOperation({ summary: 'Receive TrackDrive webhook events (GET)' })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  async handleTrackdriveWebhookGet(
    @Req() req: Request,
    @Query() query: Record<string, string>,
  ) {
    return this.processTrackdriveWebhook(req, query, {});
  }

  @Post('trackdrive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive TrackDrive webhook events (POST)' })
  @ApiBody({ description: 'TrackDrive webhook payload', schema: { type: 'object' } })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handleTrackdriveWebhookPost(
    @Req() req: Request,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Query() query: Record<string, string>,
  ) {
    this.logger.log(`TrackDrive POST - Content-Type: ${headers['content-type']}`);
    return this.processTrackdriveWebhook(req, query, body);
  }

  private async processTrackdriveWebhook(
    req: Request,
    query: Record<string, string>,
    body: any,
  ) {
    this.logger.log(`TrackDrive webhook - Method: ${req.method}, URL: ${req.originalUrl}`);
    this.logger.log(`TrackDrive webhook - Body keys: ${Object.keys(body || {}).join(', ') || 'EMPTY'}`);
    this.logger.log(`TrackDrive webhook - Query keys: ${Object.keys(query || {}).join(', ') || 'EMPTY'}`);

    // Merge body and query params (TrackDrive might send data in either)
    const payload = { ...query, ...body };
    this.logger.log(`TrackDrive payload total_duration=${payload.total_duration}, recording_url=${payload.recording_url ? 'present' : 'missing'}`);

    try {
      // TrackDrive outgoing webhooks send call data directly with fields like:
      // id, uuid, recording_url, traffic_source, offer, buyer, total_duration, etc.
      // The webhook may also send nested under body.call or body.data
      const callId =
        payload?.id ||
        payload?.call_id ||
        payload?.call?.id ||
        payload?.data?.call_id ||
        payload?.data?.id;

      const event = payload?.event || payload?.trigger_type || 'call_ended';

      if (!callId) {
        this.logger.warn('Webhook received without call ID');

        // Still send ntfy for live call alert even without call ID
        this.ntfy.sendLiveCallAlert({
          callId: 'live',
          callerNumber: payload.caller_number || payload.caller_id,
          callerState: payload.caller_state || payload.state,
          offer: payload.offer || payload.offer_name,
          trafficSource: payload.traffic_source || payload.publisher,
          buyer: payload.buyer || payload.buyer_name,
          duration: 0,
          revenue: 0,
        }).catch(() => {});

        return { status: 'notified', reason: 'No call ID but ntfy sent' };
      }

      this.logger.log(`Processing webhook event: ${event} for call: ${callId}`);

      // Queue call for async processing
      const internalCallId = await this.callsService.queueCallForProcessing(
        String(callId),
        payload,
      );

      // Link call to ping for conversion tracking
      await this.linkCallToPing(payload);

      // Send ntfy notification for live call, once per call: CallGrid fires two webhooks per call
      // (CALL_ENDED + RECORDING_COMPLETED) and resends must not ping the phone again.
      if (this.firstTime(this.liveAlerted, String(callId))) this.ntfy.sendLiveCallAlert({
        callId: String(callId),
        callerNumber: payload.caller_number || payload.caller_id,
        callerState: payload.caller_state || payload.state,
        offer: payload.offer || payload.offer_name,
        trafficSource: payload.traffic_source || payload.publisher,
        buyer: payload.buyer || payload.buyer_name,
        duration: Number(payload.total_duration) || Number(payload.answered_duration) || 0,
        revenue: Number(payload.revenue) || Number(payload.buyer_revenue) || 0,
      }).catch(() => {}); // Fire and forget

      // Real-time QA: analyze non-converted calls with recordings
      const isConverted = payload.buyer_converted === 'Converted' || payload.buyer_converted === true;
      const hasRecording = !!payload.recording_url;
      const duration = Number(payload.total_duration) || Number(payload.answered_duration) || 0;

      if (!isConverted && hasRecording && duration > 10) {
        // Once per call: CallGrid fires two webhooks per call, and each used to start its own
        // review (two AI runs, two Discord alerts). Forget entries after 24h.
        const key = String(callId);
        const now = Date.now();
        for (const [k, t] of this.realtimeStarted) if (now - t > 86400_000) this.realtimeStarted.delete(k);
        if (this.realtimeStarted.has(key)) {
          this.logger.log(`Real-time QA already started for ${key}, skipping duplicate webhook`);
        } else {
          this.realtimeStarted.set(key, now);
          this.runRealtimeQA(payload).catch((err) => {
            this.realtimeStarted.delete(key); // let a later webhook retry a failed review
            this.logger.error(`Real-time QA failed: ${err.message}`);
          });
        }
      }

      return {
        status: 'accepted',
        call_id: callId,
        internal_id: internalCallId,
        message: 'Call queued for processing',
      };
    } catch (error: any) {
      this.logger.error(`Webhook processing error: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to queue call for processing',
      };
    }
  }

  /**
   * Link incoming call to a ping record for conversion tracking
   */
  private async linkCallToPing(payload: any) {
    try {
      const callerPhone = payload.caller_number || payload.caller_id || payload.caller_phone;
      const callId = payload.id || payload.call_id;
      const duration = Number(payload.total_duration) || Number(payload.answered_duration) || 0;

      // Revenue fields from TrackDrive
      const buyerRevenue = Number(payload.buyer_revenue) || Number(payload.revenue) || null;
      const trafficSourcePayout = Number(payload.traffic_source_payout) || Number(payload.payout) || null;
      const margin = (buyerRevenue && trafficSourcePayout) ? buyerRevenue - trafficSourcePayout : null;

      if (!callerPhone && !callId) {
        return;
      }

      // Find matching ping - look for recent pings with same caller or trackdrive_call_id
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const ping = await this.prisma.inbound_ping.findFirst({
        where: {
          OR: [
            { trackdrive_call_id: callId ? String(callId) : undefined },
            { caller_phone: callerPhone },
          ],
          received_at: { gte: fiveMinutesAgo },
          status: 'accepted',
        },
        orderBy: { received_at: 'desc' },
      });

      if (ping) {
        const isConverted = duration >= 90; // Standard conversion threshold

        await this.prisma.inbound_ping.update({
          where: { id: ping.id },
          data: {
            trackdrive_call_id: callId ? String(callId) : ping.trackdrive_call_id,
            call_connected: duration > 0,
            call_duration: duration,
            converted: isConverted,
            actual_payout: buyerRevenue,
            publisher_payout: trafficSourcePayout,
            margin: margin,
            conversion_time: isConverted ? new Date() : null,
          },
        });

        this.logger.log(`Linked call ${callId} to ping ${ping.id}: duration=${duration}s, converted=${isConverted}, buyer_revenue=${buyerRevenue}, publisher_payout=${trafficSourcePayout}, margin=${margin}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to link call to ping: ${err.message}`);
    }
  }

  /**
   * Real-time QA: analyze a non-converted call immediately
   */
  private async runRealtimeQA(payload: any): Promise<void> {
    const callId = payload.id || payload.call_id;
    // Already reviewed (e.g. before a restart, or a resend): don't analyze or alert again.
    const existing = await this.prisma.non_conversion_review.findFirst({ where: { trackdrive_call_id: String(callId) }, select: { id: true } });
    if (existing) {
      this.logger.log(`Real-time QA skipped for ${callId}: already reviewed`);
      return;
    }
    this.logger.log(`Real-time QA starting for call ${callId}`);

    try {
      // Review the call
      const review = await this.nonConversionQa.reviewCall(payload);

      // Store it
      const today = new Date().toISOString().split('T')[0];
      await this.nonConversionQa.storeReviews([review], today);

      this.logger.log(`Real-time QA complete for call ${callId}: ${review.fault_side} fault - ${review.outcome_reason}`);

      // Send Discord alert for buyer/vendor faults
      if (review.fault_side === 'buyer' || review.fault_side === 'vendor') {
        const settings = await this.prisma.scheduler_settings.findUnique({ where: { id: 'singleton' } });
        if (settings?.discord_enabled && settings?.discord_webhook_url) {
          const color = review.fault_side === 'buyer' ? 0xdc2626 : 0xf59e0b;
          const embed = {
            title: `QA Alert: ${review.fault_side.toUpperCase()} Fault`,
            color,
            fields: [
              { name: 'Caller', value: fmtPhone(review.caller_number), inline: true },
              { name: 'Offer', value: review.campaign_name || 'Unknown', inline: true },
              { name: 'Call ID', value: review.trackdrive_call_id, inline: true },
              { name: 'Publisher', value: review.vendor_name || 'Unknown', inline: true },
              { name: 'Buyer', value: review.buyer_name || 'Unknown', inline: true },
              { name: 'Reason', value: review.outcome_reason.replace(/_/g, ' '), inline: true },
              { name: 'Duration', value: `${review.duration}s`, inline: true },
              { name: 'What Happened', value: (review.what_happened || '').slice(0, 500), inline: false },
            ],
            footer: { text: 'GrovLabs Real-time QA' },
            timestamp: new Date().toISOString(),
          };

          await fetch(settings.discord_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] }),
          });
        }

        // Also send ntfy alert
        await this.ntfy.sendNotification({
          title: `QA: ${review.fault_side.toUpperCase()} fault - ${review.campaign_name || 'Unknown'}`,
          message: `${fmtPhone(review.caller_number)} | ${review.vendor_name || '?'} -> ${review.buyer_name || '?'}\n${review.outcome_reason.replace(/_/g, ' ')}\n${review.what_happened?.slice(0, 200) || ''}`,
          priority: 'high',
          tags: ['warning'],
        });
      }
    } catch (err: any) {
      this.realtimeStarted.delete(String(callId)); // failed: let the next webhook for this call retry
      this.logger.error(`Real-time QA error for call ${callId}: ${err.message}`);
    }
  }

  @Get('test/recent-calls')
  @ApiOperation({ summary: 'List recent calls from TrackDrive for testing' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of calls to fetch (default 10)' })
  @ApiResponse({ status: 200, description: 'List of recent calls' })
  async listRecentCalls(@Query('limit') limit?: string) {
    const count = Math.min(parseInt(limit || '10', 10), 50);

    try {
      const response = await this.trackdrive.listCalls({
        per_page: count,
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      const calls = (response?.calls || []).map((c: any) => ({
        id: c.id,
        created_at: c.created_at,
        duration: c.total_duration || c.answered_duration,
        traffic_source: c.traffic_source,
        offer: c.offer,
        buyer: c.buyer,
        buyer_converted: c.buyer_converted,
        caller_number: c.caller_number,
        has_recording: !!c.recording_url,
        category: c.category,
      }));

      return { count: calls.length, calls };
    } catch (error: any) {
      this.logger.error(`Failed to list recent calls: ${error.message}`);
      return { error: error.message };
    }
  }

  @Post('fix-durations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fix duration for old calls by extracting from trackdrive_data' })
  @ApiResponse({ status: 200, description: 'Durations fixed' })
  async fixDurations() {
    this.logger.log('Starting duration fix for old calls...');

    // Get all calls with duration=0 that have trackdrive_data
    const calls = await this.prisma.call.findMany({
      where: { duration: 0 },
      select: { id: true, trackdrive_data: true },
    });

    let fixed = 0;
    for (const call of calls) {
      const data = call.trackdrive_data as any;
      if (!data) continue;

      const duration = Number(data.total_duration) || Number(data.answered_duration) || Number(data.duration) || 0;
      if (duration > 0) {
        await this.prisma.call.update({
          where: { id: call.id },
          data: { duration },
        });
        fixed++;
        this.logger.log(`Fixed call ${call.id}: duration=${duration}s`);
      }
    }

    this.logger.log(`Duration fix complete: ${fixed}/${calls.length} calls updated`);
    return {
      success: true,
      totalWithZeroDuration: calls.length,
      fixed,
      message: `Updated ${fixed} calls with correct duration`
    };
  }

  @Post('test/process-call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually process a specific TrackDrive call for testing' })
  @ApiBody({ schema: { type: 'object', properties: { call_id: { type: 'string' } }, required: ['call_id'] } })
  @ApiResponse({ status: 200, description: 'Call queued for processing' })
  async testProcessCall(@Body() body: { call_id: string }) {
    const { call_id } = body;

    if (!call_id) {
      return { error: 'call_id is required' };
    }

    try {
      // Fetch call details from TrackDrive
      const callDetails = await this.trackdrive.getCallDetails(call_id);
      const callData = callDetails?.call || callDetails;

      if (!callData) {
        return { error: 'Call not found in TrackDrive' };
      }

      this.logger.log(`Test processing call ${call_id}: ${JSON.stringify(callData).substring(0, 300)}`);

      // Queue for processing
      const internalId = await this.callsService.queueCallForProcessing(call_id, callData);

      return {
        status: 'queued',
        call_id,
        internal_id: internalId,
        duration: callData.total_duration || callData.answered_duration,
        has_recording: !!callData.recording_url,
        traffic_source: callData.traffic_source,
        offer: callData.offer,
      };
    } catch (error: any) {
      this.logger.error(`Test process call failed: ${error.message}`);
      return { error: error.message };
    }
  }
}
