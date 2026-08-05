import { Controller, Post, Get, Body, Query, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { VendorStatsService } from './vendor-stats.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Vendor Stats')
@Controller('api/vendor-stats')
export class VendorStatsController {
  private readonly logger = new Logger(VendorStatsController.name);

  constructor(
    private readonly vendorStatsService: VendorStatsService,
    private readonly config: ConfigService,
  ) {}

  private validateApiKey(apiKey: string | undefined): void {
    const expected = this.config.get<string>('MONITOR_API_KEY');
    if (!expected || apiKey !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('daily')
  @ApiOperation({ summary: 'Run daily vendor stats email job (cron endpoint)' })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'API key for authentication' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        dry_run: { type: 'boolean', description: 'If true, compute stats but do not send emails' },
        vendor_id: { type: 'string', description: 'Optional: run for a single vendor only' },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Job completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async runDailyStats(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { dry_run?: boolean; vendor_id?: string },
  ) {
    this.validateApiKey(apiKey);
    this.logger.log(`Daily stats job triggered (dry_run=${body?.dry_run}, vendor_id=${body?.vendor_id})`);

    const result = await this.vendorStatsService.runDailyStatsJob({
      dryRun: body?.dry_run ?? false,
      singleVendorId: body?.vendor_id,
    });

    return {
      success: true,
      message: `Processed ${result.vendorsProcessed} vendors: ${result.emailsSent} emails sent, ${result.vendorsSkipped} skipped (no calls)`,
      ...result,
    };
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview daily stats email for a vendor (returns HTML)' })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'API key for authentication' })
  @ApiQuery({ name: 'vendor_id', required: true, description: 'Vendor profile ID' })
  @ApiResponse({ status: 200, description: 'Returns stats and email HTML' })
  @ApiResponse({ status: 404, description: 'No data found' })
  async previewEmail(
    @Headers('x-api-key') apiKey: string,
    @Query('vendor_id') vendorId: string,
  ) {
    this.validateApiKey(apiKey);

    const result = await this.vendorStatsService.previewVendorEmail(vendorId);
    if (!result) {
      throw new HttpException('No data found for this vendor (no calls yesterday or vendor not found)', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      stats: result.stats,
      html: result.html,
    };
  }
}
