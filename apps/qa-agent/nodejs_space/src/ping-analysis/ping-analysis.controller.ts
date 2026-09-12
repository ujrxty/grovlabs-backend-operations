import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PingAnalysisService, InboundPingPayload, TrendDataPoint, HourlyBreakdown, StateCoverage, BidAnalysis } from './ping-analysis.service.js';

@ApiTags('Ping Intelligence')
@Controller('pings')
export class PingAnalysisController {
  constructor(private readonly pingService: PingAnalysisService) {}

  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive inbound ping from TrackDrive' })
  async receivePing(@Body() payload: InboundPingPayload) {
    return this.pingService.receivePing(payload);
  }

  @Post(':pingId/response')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record buyer response for a ping' })
  async recordResponse(
    @Param('pingId') pingId: string,
    @Body() body: {
      buyer_id: string;
      buyer_name: string;
      accepted: boolean;
      bid_amount?: number;
      rejection_reason?: string;
      response_time_ms?: number;
      raw_response?: any;
    },
  ) {
    await this.pingService.recordPingResponse(pingId, body.buyer_id, body.buyer_name, {
      accepted: body.accepted,
      bid_amount: body.bid_amount,
      rejection_reason: body.rejection_reason,
      response_time_ms: body.response_time_ms,
      raw_response: body.raw_response,
    });
    return { success: true };
  }

  @Post(':pingId/finalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize ping and determine winner' })
  async finalizePing(@Param('pingId') pingId: string) {
    await this.pingService.finalizePing(pingId);
    return { success: true };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get ping statistics' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'offer_name', required: false })
  @ApiQuery({ name: 'traffic_source', required: false })
  @ApiQuery({ name: 'state', required: false })
  async getStats(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('offer_name') offerName?: string,
    @Query('traffic_source') trafficSource?: string,
    @Query('state') state?: string,
  ) {
    return this.pingService.getStats({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      offer_name: offerName,
      traffic_source: trafficSource,
      state,
    });
  }

  @Get('stats/by-offer')
  @ApiOperation({ summary: 'Get stats segmented by offer' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getStatsByOffer(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pingService.getStatsBySegment('offer', {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats/by-source')
  @ApiOperation({ summary: 'Get stats segmented by traffic source' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getStatsBySource(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pingService.getStatsBySegment('traffic_source', {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats/by-state')
  @ApiOperation({ summary: 'Get stats segmented by state' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getStatsByState(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pingService.getStatsBySegment('state', {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats/by-buyer')
  @ApiOperation({ summary: 'Get stats segmented by buyer' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getStatsByBuyer(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pingService.getStatsBySegment('buyer', {
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('reject-reasons')
  @ApiOperation({ summary: 'Get rejection reason breakdown' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getRejectReasons(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pingService.getRejectReasons({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('duplicates')
  @ApiOperation({ summary: 'Get duplicate ping statistics' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  async getDuplicateStats(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.pingService.getDuplicateStats({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
    });
  }

  @Get('live')
  @ApiOperation({ summary: 'Get live ping feed' })
  @ApiQuery({ name: 'limit', required: false })
  async getLiveFeed(@Query('limit') limit?: string) {
    return this.pingService.getLiveFeed(limit ? parseInt(limit, 10) : 20);
  }

  @Get('stats/trends')
  @ApiOperation({ summary: 'Get ping trends over time' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'offer_name', required: false })
  @ApiQuery({ name: 'traffic_source', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'granularity', required: false, enum: ['hour', 'day'] })
  async getTrends(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('offer_name') offerName?: string,
    @Query('traffic_source') trafficSource?: string,
    @Query('state') state?: string,
    @Query('granularity') granularity?: 'hour' | 'day',
  ): Promise<TrendDataPoint[]> {
    return this.pingService.getTrends({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      offer_name: offerName,
      traffic_source: trafficSource,
      state,
      granularity,
    });
  }

  @Get('stats/hourly')
  @ApiOperation({ summary: 'Get hourly breakdown (heatmap data)' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'offer_name', required: false })
  @ApiQuery({ name: 'traffic_source', required: false })
  async getHourlyBreakdown(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('offer_name') offerName?: string,
    @Query('traffic_source') trafficSource?: string,
  ): Promise<HourlyBreakdown[]> {
    return this.pingService.getHourlyBreakdown({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      offer_name: offerName,
      traffic_source: trafficSource,
    });
  }

  @Get('stats/coverage')
  @ApiOperation({ summary: 'Get state coverage map data' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'offer_name', required: false })
  @ApiQuery({ name: 'traffic_source', required: false })
  async getCoverageMap(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('offer_name') offerName?: string,
    @Query('traffic_source') trafficSource?: string,
  ): Promise<StateCoverage[]> {
    return this.pingService.getCoverageMap({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      offer_name: offerName,
      traffic_source: trafficSource,
    });
  }

  @Get('stats/bids')
  @ApiOperation({ summary: 'Get bid analysis and distribution' })
  @ApiQuery({ name: 'start', required: false })
  @ApiQuery({ name: 'end', required: false })
  @ApiQuery({ name: 'offer_name', required: false })
  @ApiQuery({ name: 'traffic_source', required: false })
  @ApiQuery({ name: 'state', required: false })
  async getBidAnalysis(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('offer_name') offerName?: string,
    @Query('traffic_source') trafficSource?: string,
    @Query('state') state?: string,
  ): Promise<BidAnalysis> {
    return this.pingService.getBidAnalysis({
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
      offer_name: offerName,
      traffic_source: trafficSource,
      state,
    });
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get available filter options' })
  async getFilterOptions() {
    return this.pingService.getFilterOptions();
  }

  @Get(':pingId')
  @ApiOperation({ summary: 'Get ping detail with timeline' })
  async getPingDetail(@Param('pingId') pingId: string) {
    const result = await this.pingService.getPingDetail(pingId);
    if (!result) {
      throw new BadRequestException('Ping not found');
    }
    return result;
  }
}
