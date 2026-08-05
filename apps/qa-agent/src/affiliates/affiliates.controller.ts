import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Affiliates')
@Controller('api/affiliates')
export class AffiliatesController {
  private readonly logger = new Logger(AffiliatesController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all affiliates with statistics' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of affiliates' })
  async listAffiliates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = Math.min(parseInt(limit || '20', 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [affiliates, total] = await Promise.all([
      this.prisma.affiliate.findMany({
        orderBy: { flagged_calls: 'desc' },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: { calls: true, flags: true },
          },
        },
      }),
      this.prisma.affiliate.count(),
    ]);

    return {
      data: affiliates.map((a) => ({
        ...a,
        is_high_sensitivity:
          a.high_sensitivity_until != null && new Date(a.high_sensitivity_until) > new Date(),
        flag_rate:
          a.total_calls > 0
            ? Math.round((a.flagged_calls / a.total_calls) * 10000) / 100
            : 0,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get affiliate details and flag history' })
  @ApiParam({ name: 'id', description: 'Affiliate ID' })
  @ApiResponse({ status: 200, description: 'Affiliate details' })
  @ApiResponse({ status: 404, description: 'Affiliate not found' })
  async getAffiliate(@Param('id') id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: {
        flags: {
          orderBy: { created_at: 'desc' },
          take: 50,
          include: {
            call: {
              select: {
                id: true,
                trackdrive_call_id: true,
                campaign_name: true,
                duration: true,
                recording_url: true,
                created_at: true,
              },
            },
          },
        },
        calls: {
          orderBy: { created_at: 'desc' },
          take: 20,
          select: {
            id: true,
            trackdrive_call_id: true,
            campaign_name: true,
            duration: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    if (!affiliate) {
      throw new NotFoundException(`Affiliate not found: ${id}`);
    }

    return {
      ...affiliate,
      is_high_sensitivity:
        affiliate.high_sensitivity_until != null &&
        new Date(affiliate.high_sensitivity_until) > new Date(),
      flag_rate:
        affiliate.total_calls > 0
          ? Math.round((affiliate.flagged_calls / affiliate.total_calls) * 10000) / 100
          : 0,
    };
  }

  @Put(':id/monitor')
  @ApiOperation({ summary: 'Enable high-sensitivity monitoring for an affiliate' })
  @ApiParam({ name: 'id', description: 'Affiliate ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to enable monitoring', example: 7 },
        notes: { type: 'string', description: 'Optional notes', example: 'Flagged for suspicious activity' },
      },
      required: ['days'],
    },
  })
  @ApiResponse({ status: 200, description: 'Monitoring enabled' })
  @ApiResponse({ status: 404, description: 'Affiliate not found' })
  async enableMonitoring(
    @Param('id') id: string,
    @Body() body: { days: number; notes?: string },
  ) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new NotFoundException(`Affiliate not found: ${id}`);
    }

    const days = body.days || 7;
    const until = new Date();
    until.setDate(until.getDate() + days);

    const updated = await this.prisma.affiliate.update({
      where: { id },
      data: {
        high_sensitivity_until: until,
        notes: body.notes || affiliate.notes,
      },
    });

    this.logger.log(`High-sensitivity monitoring enabled for affiliate ${id} until ${until.toISOString()}`);

    return {
      message: `High-sensitivity monitoring enabled for ${days} days`,
      affiliate: {
        ...updated,
        is_high_sensitivity: true,
      },
    };
  }
}
