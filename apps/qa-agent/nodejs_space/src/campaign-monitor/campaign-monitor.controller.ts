import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CampaignMonitorService } from './campaign-monitor.service.js';

@ApiTags('Campaign Monitor')
@Controller('api/campaign-monitor')
export class CampaignMonitorController {
  private readonly logger = new Logger(CampaignMonitorController.name);

  constructor(private readonly monitorService: CampaignMonitorService) {}

  @Post('health-check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run campaign health check (called by cron every 15 min)' })
  @ApiHeader({ name: 'x-api-key', description: 'API key for authentication', required: true })
  @ApiResponse({ status: 200, description: 'Health check completed' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async runHealthCheck(
    @Headers('x-api-key') apiKey: string,
    @Body() body: any,
  ) {
    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    try {
      const result = await this.monitorService.runHealthCheck(apiKey);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      if (error.message === 'Invalid API key') {
        throw new UnauthorizedException('Invalid API key');
      }
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('rtb-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get RTB campaign stats on demand' })
  @ApiHeader({ name: 'x-api-key', description: 'API key for authentication', required: true })
  @ApiBody({ schema: { type: 'object', properties: { timeLabel: { type: 'string', example: 'Today', description: 'TrackDrive time label: Today, Yesterday, This Week, This Month, Last Hour, etc.' } } } })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getRTBStats(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { timeLabel?: string },
  ) {
    const expectedKey = this.monitorService['config'].get<string>('MONITOR_API_KEY', '');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const stats = await this.monitorService.getRTBStats(body?.timeLabel || 'Today');
    return { success: true, stats };
  }
}
