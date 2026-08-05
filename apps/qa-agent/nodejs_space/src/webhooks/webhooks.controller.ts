import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { CallsService } from '../calls/calls.service.js';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly callsService: CallsService) {}

  @Post('trackdrive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive TrackDrive webhook events' })
  @ApiBody({ description: 'TrackDrive webhook payload', schema: { type: 'object' } })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handleTrackdriveWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log(`TrackDrive webhook received: ${JSON.stringify(body).substring(0, 500)}`);

    try {
      // TrackDrive outgoing webhooks send call data directly with fields like:
      // id, uuid, recording_url, traffic_source, offer, buyer, total_duration, etc.
      // The webhook may also send nested under body.call or body.data
      const callId =
        body?.id ||
        body?.call_id ||
        body?.call?.id ||
        body?.data?.call_id ||
        body?.data?.id;

      const event = body?.event || body?.trigger_type || 'call_ended';

      if (!callId) {
        this.logger.warn('Webhook received without call ID');
        return { status: 'ignored', reason: 'No call ID found in payload' };
      }

      this.logger.log(`Processing webhook event: ${event} for call: ${callId}`);

      // Queue call for async processing
      const internalCallId = await this.callsService.queueCallForProcessing(
        String(callId),
        body,
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
}
