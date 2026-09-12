import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdvancedAnalyticsService } from './advanced-analytics.service.js';

function daysToDateRange(days: number) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start };
}

@ApiTags('Advanced Analytics')
@Controller('analytics')
export class AdvancedAnalyticsController {
  constructor(private readonly analyticsService: AdvancedAnalyticsService) {}

  @Get('fraud-stats')
  @ApiOperation({ summary: 'Get duplicate/fraud detection statistics' })
  @ApiQuery({ name: 'days', required: false })
  async getFraudStats(@Query('days') days?: string) {
    return this.analyticsService.getFraudStats(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('duplicate-callers')
  @ApiOperation({ summary: 'Get list of duplicate/repeat callers' })
  @ApiQuery({ name: 'limit', required: false })
  async getDuplicateCallers(@Query('limit') limit?: string) {
    return this.analyticsService.getDuplicateCallers(limit ? parseInt(limit) : 50);
  }

  @Get('buyer-leaderboard')
  @ApiOperation({ summary: 'Get buyer performance leaderboard' })
  @ApiQuery({ name: 'days', required: false })
  async getBuyerLeaderboard(@Query('days') days?: string) {
    return this.analyticsService.getBuyerLeaderboard(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('publisher-quality')
  @ApiOperation({ summary: 'Get publisher quality scores' })
  @ApiQuery({ name: 'days', required: false })
  async getPublisherQuality(@Query('days') days?: string) {
    return this.analyticsService.getPublisherQuality(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('coverage-gaps')
  @ApiOperation({ summary: 'Identify coverage gaps and missed opportunities' })
  async getCoverageGaps() {
    return this.analyticsService.getCoverageGaps();
  }

  @Get('geo-heatmap')
  @ApiOperation({ summary: 'Get geographic performance heatmap data' })
  @ApiQuery({ name: 'days', required: false })
  async getGeoHeatmap(@Query('days') days?: string) {
    return this.analyticsService.getGeoHeatmap(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('time-heatmap')
  @ApiOperation({ summary: 'Get time-based performance heatmap (hour x day)' })
  @ApiQuery({ name: 'days', required: false })
  async getTimeHeatmap(@Query('days') days?: string) {
    return this.analyticsService.getTimeHeatmap(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('latency-stats')
  @ApiOperation({ summary: 'Get latency forensics and buyer response times' })
  @ApiQuery({ name: 'days', required: false })
  async getLatencyStats(@Query('days') days?: string) {
    return this.analyticsService.getLatencyStats(daysToDateRange(days ? parseInt(days) : 7));
  }

  @Get('revenue-opportunities')
  @ApiOperation({ summary: 'Get AI-powered revenue optimization suggestions' })
  async getRevenueOpportunities() {
    return this.analyticsService.getRevenueOpportunities();
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Detect real-time anomalies in ping patterns' })
  async detectAnomalies() {
    return this.analyticsService.detectAnomalies();
  }

  @Get('bid-distribution')
  @ApiOperation({ summary: 'Get bid distribution box plot data per buyer' })
  @ApiQuery({ name: 'days', required: false })
  async getBidDistribution(@Query('days') days?: string) {
    return this.analyticsService.getBidDistribution(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('ping-flow')
  @ApiOperation({ summary: 'Get ping flow tree data (Publisher → Campaign → Buyer)' })
  @ApiQuery({ name: 'days', required: false })
  async getPingFlow(@Query('days') days?: string) {
    return this.analyticsService.getPingFlow(daysToDateRange(days ? parseInt(days) : 30));
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive dashboard data' })
  @ApiQuery({ name: 'days', required: false })
  async getDashboard(@Query('days') days?: string) {
    const range = daysToDateRange(days ? parseInt(days) : 30);
    const latencyRange = daysToDateRange(Math.min(days ? parseInt(days) : 30, 7));
    const [
      buyerLeaderboard,
      publisherQuality,
      coverageGaps,
      geoHeatmap,
      timeHeatmap,
      latencyStats,
      revenueOpportunities,
      anomalies,
      fraudStats,
    ] = await Promise.all([
      this.analyticsService.getBuyerLeaderboard(range),
      this.analyticsService.getPublisherQuality(range),
      this.analyticsService.getCoverageGaps(),
      this.analyticsService.getGeoHeatmap(range),
      this.analyticsService.getTimeHeatmap(range),
      this.analyticsService.getLatencyStats(latencyRange),
      this.analyticsService.getRevenueOpportunities(),
      this.analyticsService.detectAnomalies(),
      this.analyticsService.getFraudStats(range),
    ]);

    return {
      buyerLeaderboard,
      publisherQuality,
      coverageGaps,
      geoHeatmap,
      timeHeatmap,
      latencyStats,
      revenueOpportunities,
      anomalies,
      fraudStats,
    };
  }
}
