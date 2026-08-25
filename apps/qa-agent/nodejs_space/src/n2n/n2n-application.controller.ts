import {
  Controller, Get, Post, Param, Body, Query, Req, Logger, HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEmail } from 'class-validator';
import { N2NApplicationService } from './n2n-application.service.js';

class CreateApplicationDto {
  @IsString()
  company_name: string;

  @IsOptional()
  @IsString()
  organized_in?: string;

  @IsString()
  contact_name: string;

  @IsEmail()
  contact_email: string;

  @IsString()
  contact_phone: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsBoolean()
  wants_to_buy: boolean;

  @IsBoolean()
  wants_to_sell: boolean;

  @IsOptional()
  @IsString()
  verticals?: string;

  @IsOptional()
  @IsString()
  estimated_volume?: string;

  @IsOptional()
  @IsString()
  traffic_sources?: string;

  @IsOptional()
  @IsString()
  current_partners?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  referred_by?: string;

  @IsBoolean()
  terms_agreed: boolean;
}

@ApiTags('N2N Partner Applications')
@Controller('n2n/applications')
export class N2NApplicationController {
  private readonly logger = new Logger(N2NApplicationController.name);

  constructor(private readonly svc: N2NApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new N2N partner application' })
  async createApplication(
    @Body() dto: CreateApplicationDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';

    return this.svc.createApplication({
      ...dto,
      agreed_ip: ip,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all N2N partner applications' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (pending, approved, rejected)' })
  async listApplications(@Query('status') status?: string) {
    return this.svc.listApplications(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application details' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  async getApplication(@Param('id') id: string) {
    return this.svc.getApplication(id);
  }

  @Get('status/:token')
  @ApiOperation({ summary: 'Check application status by token' })
  @ApiParam({ name: 'token', description: 'Status token from confirmation email' })
  async getApplicationStatus(@Param('token') token: string) {
    const app = await this.svc.getApplicationByToken(token);
    return {
      company_name: app.company_name,
      status: app.status,
      status_reason: app.status_reason,
      submitted_at: app.created_at,
      reviewed_at: app.reviewed_at,
    };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve an application' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  async approveApplication(
    @Param('id') id: string,
    @Body() body: { reviewed_by?: string },
  ) {
    return this.svc.approveApplication(id, body.reviewed_by);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject an application' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  async rejectApplication(
    @Param('id') id: string,
    @Body() body: { reason?: string; reviewed_by?: string },
  ) {
    return this.svc.rejectApplication(id, body.reason, body.reviewed_by);
  }
}
