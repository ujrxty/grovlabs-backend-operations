import { Controller, Post, Get, Body, Headers, Query, Logger, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CallsService } from '../calls/calls.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { Request } from 'express';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly callsService: CallsService,
    private readonly trackdrive: TrackDriveService,
  ) {}

  @Post('trackdrive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive TrackDrive webhook events' })
  @ApiBody({ description: 'TrackDrive webhook payload', schema: { type: 'object' } })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handleTrackdriveWebhook(
    @Req() req: Request,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Query() query: Record<string, string>,
  ) {
    this.logger.log(`TrackDrive webhook - URL: ${req.originalUrl}`);
    this.logger.log(`TrackDrive webhook - Content-Type: ${headers['content-type']}`);
    this.logger.log(`TrackDrive webhook - Body keys: ${Object.keys(body || {}).join(', ') || 'EMPTY'}`);
    this.logger.log(`TrackDrive webhook - Query keys: ${Object.keys(query || {}).join(', ') || 'EMPTY'}`);
    this.logger.log(`TrackDrive webhook - req.query: ${JSON.stringify(req.query)}`);
    this.logger.log(`TrackDrive webhook received: ${JSON.stringify(body).substring(0, 500)}`);

    // Merge body and query params (TrackDrive might send data in either)
    const payload = { ...query, ...body };

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
        return { status: 'ignored', reason: 'No call ID found in payload' };
      }

      this.logger.log(`Processing webhook event: ${event} for call: ${callId}`);

      // Queue call for async processing
      const internalCallId = await this.callsService.queueCallForProcessing(
        String(callId),
        payload,
      );

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
