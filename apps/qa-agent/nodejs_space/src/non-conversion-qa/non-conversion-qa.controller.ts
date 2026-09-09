import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { NonConversionQaService } from './non-conversion-qa.service.js';

@ApiTags('Non-Conversion QA')
@Controller('non-conversion-qa')
export class NonConversionQaController {
  private readonly logger = new Logger(NonConversionQaController.name);

  constructor(
    private readonly service: NonConversionQaService,
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
    summary: 'Run the daily non-conversion QA review (fire-and-forget)',
    description:
      'Fetches all non-converted calls for the target date, analyzes each recording with AI to attribute fault (buyer negligence vs. vendor lead quality), stores results, and emails/Telegrams a two-sided report to the owner. Returns immediately; work continues in the background.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          example: '2026-07-06',
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
    const dateStr = await this.service.resolveDate(body?.date);
    const cap = typeof body?.cap === 'number' ? body.cap : undefined;
    const notify = typeof body?.notify === 'boolean' ? body.notify : true;

    // Fire-and-forget: run in the background so the HTTP request returns promptly.
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
      message: 'Non-conversion review started in the background. A report will be emailed when complete.',
    };
  }

  @Post('review-sample')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Synchronously review a small sample (for testing)',
    description:
      'Reviews up to `limit` non-converted calls synchronously and returns the results without sending a report. Useful for verifying behavior on real data.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', example: '2026-07-06' },
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
    const dateStr = await this.service.resolveDate(body?.date);
    const limit = typeof body?.limit === 'number' ? body.limit : 5;

    const nonConverted = await this.service.fetchNonConvertedCalls(dateStr);
    const sample = nonConverted.slice(0, limit);
    const { reviews, failures } = await this.service.reviewCallsBatched(sample, 3);
    let stored = 0;
    if (body?.store) {
      stored = await this.service.storeReviews(reviews, dateStr);
    }
    return {
      date: dateStr,
      totalNonConverted: nonConverted.length,
      requested: limit,
      reviewed: reviews.length,
      failures,
      stored,
      reviews,
    };
  }

  @Get('reviews')
  @ApiOperation({
    summary: 'Get stored non-conversion reviews for a date',
    description: 'Returns all stored non-conversion review records for the given PST date.',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-07-06', description: "PST date (YYYY-MM-DD) or 'yesterday'. Defaults to today." })
  async getReviews(@Query('date') date?: string) {
    const dateStr = await this.service.resolveDate(date);
    const reviews = await this.service.getReviews(dateStr);
    const buyerFault = reviews.filter((r) => r.fault_side === 'buyer').length;
    const vendorFault = reviews.filter((r) => r.fault_side === 'vendor').length;
    return {
      date: dateStr,
      total: reviews.length,
      buyerFault,
      vendorFault,
      reviews,
    };
  }

  @Post('backfill')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Backfill non-conversion reviews for a date range',
    description:
      'Processes each day in the range sequentially, reviewing non-converted calls. Returns progress. Call repeatedly until done=true.',
  })
  @ApiHeader({ name: 'x-api-key', required: true, description: 'Monitor API key' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        from: { type: 'string', example: '2026-08-01', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', example: '2026-09-07', description: 'End date (YYYY-MM-DD). Defaults to today.' },
        maxCallsPerDay: { type: 'number', example: 100, description: 'Max calls to review per day. Defaults to 100.' },
        maxDays: { type: 'number', example: 3, description: 'Max days to process per invocation. Defaults to 3.' },
      },
      required: ['from'],
    },
  })
  async backfill(
    @Headers('x-api-key') apiKey: string,
    @Body() body: { from: string; to?: string; maxCallsPerDay?: number; maxDays?: number },
  ) {
    this.assertApiKey(apiKey);
    const from = body.from;
    const to = body.to || await this.service.resolveDate();
    const maxCallsPerDay = body.maxCallsPerDay ?? 100;
    const maxDays = body.maxDays ?? 3;

    const result = await this.service.backfillRange(from, to, maxCallsPerDay, maxDays);
    return result;
  }
}
