import { Controller, Post, Get, Body, Headers, Query, Logger, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CallsService } from '../calls/calls.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NtfyService } from '../ntfy/ntfy.service.js';
import { NonConversionQaService } from '../non-conversion-qa/non-conversion-qa.service.js';
import { DiscordService } from '../discord/discord.service.js';
import { Request } from 'express';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly callsService: CallsService,
    private readonly trackdrive: TrackDriveService,
    private readonly prisma: PrismaService,
    private readonly ntfy: NtfyService,
    private readonly nonConversionQa: NonConversionQaService,
    private readonly discord: DiscordService,
  ) {}

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

      // Send ntfy notification for live call
      this.ntfy.sendLiveCallAlert({
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
        this.runRealtimeQA(payload).catch((err) => {
          this.logger.error(`Real-time QA failed: ${err.message}`);
        });
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
              { name: 'Call ID', value: review.trackdrive_call_id, inline: true },
              { name: 'Offer', value: review.campaign_name || 'Unknown', inline: true },
              { name: review.fault_side === 'buyer' ? 'Buyer' : 'Vendor', value: review.fault_side === 'buyer' ? (review.buyer_name || 'Unknown') : review.vendor_name, inline: true },
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
          message: `${review.outcome_reason.replace(/_/g, ' ')}\n${review.what_happened?.slice(0, 200) || ''}`,
          priority: 'high',
          tags: ['warning'],
        });
      }
    } catch (err: any) {
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
