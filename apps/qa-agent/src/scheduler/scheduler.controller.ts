import { Controller, Post, Get, Body, Query, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SchedulerService } from './scheduler.service.js';

@ApiTags('Scheduler')
@Controller('api/scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(
    private readonly scheduler: SchedulerService,
    private readonly config: ConfigService,
  ) {}

  private validateApiKey(apiKey: string | undefined): void {
    const expected = this.config.get<string>('MONITOR_API_KEY');
    if (!expected || apiKey !== expected) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get scheduler settings' })
  async getSettings() {
    const settings = await this.scheduler.getSettings();
    const timezones = this.scheduler.getTimezoneOptions();
    return { settings, timezones };
  }

  @Post('settings')
  @ApiOperation({ summary: 'Update scheduler settings' })
  async updateSettings(@Body() body: any) {
    this.logger.log('Updating scheduler settings');
    const settings = await this.scheduler.updateSettings(body);
    return { success: true, settings };
  }

  @Post('vendor-stats')
  @ApiOperation({ summary: 'Trigger vendor daily stats emails' })
  @ApiHeader({ name: 'x-api-key', required: true })
  async triggerVendorStats(@Headers('x-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
    this.logger.log('Manual trigger: vendor stats');
    const result = await this.scheduler.triggerVendorStats();
    return { success: true, ...result };
  }

  @Post('non-conversion-qa')
  @ApiOperation({ summary: 'Trigger non-conversion QA review' })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD date to review' })
  async triggerNonConversionQa(
    @Headers('x-api-key') apiKey: string,
    @Query('date') date?: string,
  ) {
    this.validateApiKey(apiKey);
    this.logger.log(`Manual trigger: non-conversion QA for ${date || 'today'}`);
    const result = await this.scheduler.triggerNonConversionQa(date);
    return { success: true, ...result };
  }

  @Post('sales-qa')
  @ApiOperation({ summary: 'Trigger sales QA review' })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD date to review' })
  async triggerSalesQa(
    @Headers('x-api-key') apiKey: string,
    @Query('date') date?: string,
  ) {
    this.validateApiKey(apiKey);
    this.logger.log(`Manual trigger: sales QA for ${date || 'today'}`);
    const result = await this.scheduler.triggerSalesQa(date);
    return { success: true, ...result };
  }

  @Post('all')
  @ApiOperation({ summary: 'Trigger all daily reports (vendor stats, non-conversion QA, sales QA)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD date for QA reviews' })
  async triggerAll(
    @Headers('x-api-key') apiKey: string,
    @Query('date') date?: string,
  ) {
    this.validateApiKey(apiKey);
    this.logger.log(`Manual trigger: ALL reports for ${date || 'today'}`);

    const results = {
      vendorStats: null as any,
      nonConversionQa: null as any,
      salesQa: null as any,
    };

    try {
      results.vendorStats = await this.scheduler.triggerVendorStats();
    } catch (err: any) {
      results.vendorStats = { error: err.message };
    }

    try {
      results.nonConversionQa = await this.scheduler.triggerNonConversionQa(date);
    } catch (err: any) {
      results.nonConversionQa = { error: err.message };
    }

    try {
      results.salesQa = await this.scheduler.triggerSalesQa(date);
    } catch (err: any) {
      results.salesQa = { error: err.message };
    }

    return { success: true, results };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get scheduler status' })
  async getStatus() {
    const enabled = this.config.get<string>('SCHEDULER_ENABLED', 'false') === 'true';
    return {
      enabled,
      schedule: {
        vendorStats: '6 PM PST daily',
        nonConversionQa: '7 PM PST daily',
        salesQa: '8 PM PST daily',
      },
      endpoints: {
        vendorStats: 'POST /api/scheduler/vendor-stats',
        nonConversionQa: 'POST /api/scheduler/non-conversion-qa',
        salesQa: 'POST /api/scheduler/sales-qa',
        all: 'POST /api/scheduler/all',
      },
    };
  }
}
