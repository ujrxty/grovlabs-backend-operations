import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { CallsService } from '../calls/calls.service.js';

@ApiTags('Analytics')
@Controller('api')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly callsService: CallsService,
  ) {}

  @Get('analytics/dashboard')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async getDashboard() {
    const [totalCalls, totalFlagged, totalAffiliates, recentFlags, topOffenders] =
      await Promise.all([
        this.prisma.call.count(),
        this.prisma.qa_analysis.count({ where: { is_flagged: true } }),
        this.prisma.affiliate.count(),
        this.prisma.flag.findMany({
          orderBy: { created_at: 'desc' },
          take: 10,
          include: {
            call: {
              select: {
                trackdrive_call_id: true,
                campaign_name: true,
                duration: true,
                recording_url: true,
              },
            },
            affiliate: { select: { name: true, trackdrive_id: true } },
          },
        }),
        this.prisma.affiliate.findMany({
          where: { flagged_calls: { gt: 0 } },
          orderBy: { flagged_calls: 'desc' },
          take: 10,
          select: {
            id: true,
            name: true,
            trackdrive_id: true,
            total_calls: true,
            flagged_calls: true,
            trust_score: true,
            high_sensitivity_until: true,
          },
        }),
      ]);

    const flagRate = totalCalls > 0 ? Math.round((totalFlagged / totalCalls) * 10000) / 100 : 0;

    // Severity breakdown
    const severityBreakdown = await this.prisma.flag.groupBy({
      by: ['severity'],
      _count: { id: true },
    });

    return {
      overview: {
        total_calls: totalCalls,
        total_flagged: totalFlagged,
        flag_rate_percent: flagRate,
        total_affiliates: totalAffiliates,
      },
      severity_breakdown: severityBreakdown.map((s) => ({
        severity: s.severity,
        count: s._count.id,
      })),
      top_offenders: topOffenders.map((o) => ({
        ...o,
        flag_rate:
          o.total_calls > 0
            ? Math.round((o.flagged_calls / o.total_calls) * 10000) / 100
            : 0,
        is_high_sensitivity:
          o.high_sensitivity_until != null && new Date(o.high_sensitivity_until) > new Date(),
      })),
      recent_flags: recentFlags,
    };
  }

  @Get('calls/flagged')
  @ApiOperation({ summary: 'List flagged calls with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'affiliate_id', required: false, type: String })
  @ApiQuery({ name: 'severity', required: false, enum: ['low', 'medium', 'high', 'critical'] })
  @ApiQuery({ name: 'start_date', required: false, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'end_date', required: false, type: String, description: 'ISO date string' })
  @ApiResponse({ status: 200, description: 'List of flagged calls' })
  async getFlaggedCalls(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('affiliate_id') affiliateId?: string,
    @Query('severity') severity?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.callsService.getFlaggedCalls({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      affiliateId,
      severity,
      startDate,
      endDate,
    });
  }
}
