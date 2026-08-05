import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, Matches } from 'class-validator';
import { ReviewService } from './review.service.js';

class HistoricalReviewDto {
  @ApiProperty({ example: '2026-05-10', description: 'Start date (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom must be YYYY-MM-DD format' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-05-11', description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo must be YYYY-MM-DD format' })
  dateTo!: string;

  @ApiProperty({ required: false, example: 'Auto Insurance RTB', description: 'Filter by offer name' })
  @IsOptional()
  @IsString()
  offerFilter?: string;

  @ApiProperty({ required: false, description: 'Filter by traffic source/affiliate name' })
  @IsOptional()
  @IsString()
  trafficSourceFilter?: string;

  @ApiProperty({ required: false, default: true, description: 'Skip calls already in database' })
  @IsOptional()
  @IsBoolean()
  skipAlreadyAnalyzed?: boolean;

  @ApiProperty({ required: false, default: 50, description: 'Maximum number of calls to analyze' })
  @IsOptional()
  @IsNumber()
  maxCalls?: number;

  @ApiProperty({ required: false, description: 'Override minimum duration threshold (seconds)' })
  @IsOptional()
  @IsNumber()
  minDuration?: number;
}

@ApiTags('Historical Review')
@Controller('api/review')
export class ReviewController {
  private readonly logger = new Logger(ReviewController.name);

  constructor(private readonly reviewService: ReviewService) {}

  @Post('historical')
  @ApiOperation({
    summary: 'Run historical call review',
    description: 'Fetches calls from TrackDrive for a date range, transcribes and analyzes them for cold transfer patterns. Sends a summary report to Telegram when complete.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['dateFrom', 'dateTo'],
      properties: {
        dateFrom: { type: 'string', example: '2026-05-10', description: 'Start date (YYYY-MM-DD)' },
        dateTo: { type: 'string', example: '2026-05-11', description: 'End date (YYYY-MM-DD)' },
        offerFilter: { type: 'string', example: 'Auto Insurance RTB', description: 'Filter by offer name (optional)' },
        trafficSourceFilter: { type: 'string', description: 'Filter by traffic source/affiliate name (optional)' },
        skipAlreadyAnalyzed: { type: 'boolean', default: true, description: 'Skip calls already in database' },
        maxCalls: { type: 'number', default: 50, description: 'Maximum number of calls to analyze' },
        minDuration: { type: 'number', description: 'Override minimum duration threshold (seconds)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Review completed successfully with summary' })
  @ApiResponse({ status: 409, description: 'Another review is already in progress' })
  async runHistoricalReview(@Body() body: HistoricalReviewDto) {
    this.logger.log(`Historical review requested: ${body.dateFrom} to ${body.dateTo}, offer: ${body.offerFilter || 'ALL'}`);

    try {
      const summary = await this.reviewService.runHistoricalReview({
        dateFrom: body.dateFrom,
        dateTo: body.dateTo,
        offerFilter: body.offerFilter,
        trafficSourceFilter: body.trafficSourceFilter,
        skipAlreadyAnalyzed: body.skipAlreadyAnalyzed,
        maxCalls: body.maxCalls,
        minDuration: body.minDuration,
      });

      return {
        status: 'completed',
        summary: {
          reviewId: summary.reviewId,
          dateRange: summary.dateRange,
          offerFilter: summary.offerFilter,
          totalCallsFetched: summary.totalCallsFetched,
          totalQualifying: summary.totalQualifying,
          totalAnalyzed: summary.totalAnalyzed,
          totalFlagged: summary.totalFlagged,
          totalClean: summary.totalClean,
          totalSkipped: summary.totalSkipped,
          totalErrors: summary.totalErrors,
          durationSeconds: Math.round(summary.durationMs / 1000),
          flaggedCalls: summary.flaggedCalls.map(c => ({
            trackdriveCallId: c.trackdriveCallId,
            callerNumber: c.callerNumber,
            affiliateName: c.affiliateName,
            campaignName: c.campaignName,
            duration: c.duration,
            confidenceScore: c.confidenceScore,
            aiSummary: c.aiSummary,
          })),
        },
      };
    } catch (error: any) {
      if (error.message.includes('already in progress')) {
        throw new HttpException(error.message, HttpStatus.CONFLICT);
      }
      this.logger.error(`Historical review failed: ${error.message}`);
      throw new HttpException(`Review failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
