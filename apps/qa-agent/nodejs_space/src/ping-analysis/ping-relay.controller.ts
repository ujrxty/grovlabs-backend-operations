import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PingRelayService } from './ping-relay.service.js';
import { Request } from 'express';

@ApiTags('Ping Relay')
@Controller('ping-relay')
export class PingRelayController {
  constructor(private readonly relayService: PingRelayService) {}

  @Get('buyers')
  @ApiOperation({ summary: 'List all buyers with relay status' })
  async listBuyers() {
    const buyers = await this.relayService.listBuyersWithRelayStatus();
    const stats = await this.relayService.getRelayStats();
    return { buyers, stats };
  }

  @Get('buyers/:buyerId')
  @ApiOperation({ summary: 'Get buyer details including ping URL from TrackDrive' })
  async getBuyerDetails(@Param('buyerId') buyerId: string) {
    return this.relayService.getBuyerDetails(buyerId);
  }

  @Post('relay/enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable relay for a buyer' })
  async enableRelay(
    @Body() body: {
      td_buyer_id: string;
      platform: string;
      original_ping_url: string;
      td_conversion_id: string;
    },
  ) {
    return this.relayService.enableRelay(
      body.td_buyer_id,
      body.platform,
      body.original_ping_url,
      body.td_conversion_id,
    );
  }

  @Post('relay/disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable relay for a buyer' })
  async disableRelay(@Body() body: { td_buyer_id: string }) {
    return this.relayService.disableRelay(body.td_buyer_id);
  }

  @Post('relay/:relayKey')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Relay endpoint - receives ping from TrackDrive and forwards to buyer' })
  async handleRelay(
    @Param('relayKey') relayKey: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    // Forward the ping through the relay
    return this.relayService.handleRelayPing(relayKey, payload, headers);
  }

  @Get('relay/stats')
  @ApiOperation({ summary: 'Get overall relay statistics' })
  async getStats() {
    return this.relayService.getRelayStats();
  }
}
