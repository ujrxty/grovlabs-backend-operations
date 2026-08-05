import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiBody } from '@nestjs/swagger';
import { SalesQaService } from './sales-qa.service.js';

@ApiTags('Sales Monitoring QA')
@Controller('sales-qa')
export class SalesQaController {
  private readonly logger = new Logger(SalesQaController.name);

  constructor(
    private readonly service: SalesQaService,
    private readonly config: ConfigService,
  ) {}

  private assertApiKey(apiKey?: string) {
    const expected = this.config.get<string>('MONITOR_API_KEY', '');
    if (!expected || apiKey !== expected) {
      throw new UnauthorizedException('Invalid or missing x-api-key');
    }
  }

  @Post('run-daily')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Run the daily sales-monitoring QA review (fire-and-forget)',
    description:
      'Fetches all connected + converted (billable) calls for the target date, listens to each recording with AI to detect whether the insurance rep issued a quote and how the lead responded (sale, accepted-but-deferred, pending approval, received/reviewing, declined, or no quote issued), stores results, and emails/Telegrams a buyer CPA funnel report to the owner. Returns immediately; work continues in the background.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          example: '2026-07-14',
          description: "PST date (YYYY-MM-DD) or 'yesterday'. Defaults to today PST.",
        },
        cap: {
          type: 'number',
          example: 300,
          description: 'Max number of calls to review (safety cap). Defaults to 300.',
        },
        notify: {
          type: 'boolean',
          example: true,
          description: 'Whether to send the email/Telegram report. Defaults to true.',
        },
      },
    },
  })
  async runDaily(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { date?: string; cap?: number; notify?: boolean },
  ) {
    this.assertApiKey(apiKey);
    const dateStr = this.service.resolveDate(body?.date);
    const cap = typeof body?.cap === 'number' ? body.cap : undefined;
    const notify = typeof body?.notify === 'boolean' ? body.notify : true;

    void this.service
      .runDailyReview(dateStr, { cap, notify })
      .then((summary) => {
        this.logger.log(`run-daily completed: ${JSON.stringify(summary)}`);
      })
      .catch((err: any) => {
        this.logger.error(`run-daily failed for ${dateStr}: ${err.message}`);
      });

    return {
      status: 'started',
      date: dateStr,
      message:
        'Sales-monitoring review started in the background. A report will be emailed when complete.',
    };
  }

  @Post('run-incremental')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Incrementally review today (or a given date) - called by the work-hours scheduled task',
    description:
      'Fetches the tracked converted/billable calls (auto insurance, home insurance, pest control only) for the target date, skips any already reviewed, AI-reviews only the NEW calls, and stores them. No email/Telegram is sent - results are viewed on the admin dashboard. Returns immediately; work continues in the background.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          example: '2026-07-15',
          description: "PST date (YYYY-MM-DD) or 'yesterday'. Defaults to today PST.",
        },
        cap: { type: 'number', example: 400, description: 'Max NEW calls to review this run.' },
      },
    },
  })
  async runIncremental(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { date?: string; cap?: number },
  ) {
    this.assertApiKey(apiKey);
    const dateStr = this.service.resolveDate(body?.date);
    const cap = typeof body?.cap === 'number' ? body.cap : undefined;

    void this.service
      .runIncremental(dateStr, { cap })
      .then((summary) => {
        this.logger.log(`run-incremental completed: ${JSON.stringify(summary)}`);
      })
      .catch((err: any) => {
        this.logger.error(`run-incremental failed for ${dateStr}: ${err.message}`);
      });

    return {
      status: 'started',
      date: dateStr,
      message: 'Incremental sales review started in the background. Results appear on the dashboard.',
    };
  }

  @Post('backfill')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Backfill a historical date range in bounded chunks (called by a temporary scheduled task)',
    description:
      'Scans days from `from` to `to`, and reviews un-reviewed tracked calls (auto/home insurance, pest control) up to `maxCalls` per invocation. Idempotent and resumable - keep calling until the response has `done: true`. Runs synchronously and returns the chunk result.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        from: { type: 'string', example: '2026-06-01', description: 'Start PST date (inclusive).' },
        to: { type: 'string', example: '2026-07-15', description: 'End PST date (inclusive). Defaults to today.' },
        maxCalls: { type: 'number', example: 60, description: 'Max calls to review this invocation. Defaults to 60.' },
      },
      required: ['from'],
    },
  })
  async backfill(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { from: string; to?: string; maxCalls?: number },
  ) {
    this.assertApiKey(apiKey);
    const from = this.service.resolveDate(body?.from);
    const to = this.service.resolveDate(body?.to);
    const maxCalls = typeof body?.maxCalls === 'number' ? body.maxCalls : 60;
    return this.service.backfillChunk(from, to, maxCalls);
  }

  @Post('recheck-sales')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Targeted recovery pass for completed sales in a date range',
    description:
      'Re-reviews only the calls that could plausibly hide a completed sale (a dollar quote was issued and payment was mentioned) but are not currently marked as a sale, applies the improved payment-collected detection, and promotes genuine sales back to sale_completed. Does NOT re-review the whole universe. Runs synchronously; returns counts including how many were promoted to sale_completed.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        from: { type: 'string', example: '2026-06-01', description: 'Start PST date (inclusive).' },
        to: { type: 'string', example: '2026-06-30', description: 'End PST date (inclusive). Defaults to today.' },
        category: {
          type: 'string',
          example: 'auto_insurance',
          description: 'Optional campaign category filter (auto_insurance | home_insurance | pest_control).',
        },
        maxCalls: { type: 'number', example: 200, description: 'Max candidate calls to re-review this invocation. Defaults to 60.' },
      },
      required: ['from'],
    },
  })
  async recheckSales(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { from: string; to?: string; category?: string; maxCalls?: number },
  ) {
    this.assertApiKey(apiKey);
    const from = this.service.resolveDate(body?.from);
    const to = this.service.resolveDate(body?.to);
    const maxCalls = typeof body?.maxCalls === 'number' ? body.maxCalls : 60;
    return this.service.recheckSales(from, to, body?.category, maxCalls);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Per-campaign / per-vendor sales funnel aggregates for a date range (dashboard feed)',
    description:
      'Returns funnel counts (quotes issued, sales, deferred, pending approval, reviewing, declined, no-quote) grouped by campaign category and by vendor within each campaign, for the given date range.',
  })
  @ApiQuery({ name: 'from', required: true, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-07-15' })
  @ApiQuery({
    name: 'category',
    required: false,
    example: 'auto_insurance',
    description: 'Optional: auto_insurance | pest_control | home_insurance',
  })
  async summary(
    @Query('from') from: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
  ) {
    const fromStr = this.service.resolveDate(from);
    const toStr = this.service.resolveDate(to);
    return this.service.aggregateRange(fromStr, toStr, category);
  }

  @Post('review-sample')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Synchronously review a small sample (for testing)',
    description:
      'Reviews up to `limit` converted/billable calls synchronously and returns the results without sending a report. Useful for verifying behavior on real data.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', example: '2026-07-14' },
        limit: { type: 'number', example: 5 },
        store: { type: 'boolean', example: false },
      },
    },
  })
  async reviewSample(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { date?: string; limit?: number; store?: boolean },
  ) {
    this.assertApiKey(apiKey);
    const dateStr = this.service.resolveDate(body?.date);
    const limit = typeof body?.limit === 'number' ? body.limit : 5;

    const converted = await this.service.fetchConvertedCalls(dateStr);
    const sample = converted.slice(0, limit);
    const { reviews, failures } = await this.service.reviewCallsBatched(sample, 3);
    let stored = 0;
    if (body?.store) {
      stored = await this.service.storeReviews(reviews, dateStr);
    }
    return {
      date: dateStr,
      totalConverted: converted.length,
      requested: limit,
      reviewed: reviews.length,
      failures,
      stored,
      reviews,
    };
  }

  @Get('reviews')
  @ApiOperation({
    summary: 'Get stored sales-monitoring reviews for a date',
    description: 'Returns all stored sales QA review records for the given PST date.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-07-14',
    description: "PST date (YYYY-MM-DD) or 'yesterday'. Defaults to today.",
  })
  async getReviews(@Query('date') date?: string) {
    const dateStr = this.service.resolveDate(date);
    const reviews = await this.service.getReviews(dateStr);
    const sales = reviews.filter((r) => r.outcome_category === 'sale_completed').length;
    const quotesIssued = reviews.filter((r) => r.quote_issued).length;
    return {
      date: dateStr,
      total: reviews.length,
      quotesIssued,
      sales,
      reviews,
    };
  }
}
