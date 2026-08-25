import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res, Logger, HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { N2NService } from './n2n.service.js';

// DTOs
class CreatePartnerDto {
  @IsString()
  legal_name: string;

  @IsOptional()
  @IsString()
  organized_in?: string;

  @IsString()
  contact_name: string;

  @IsString()
  contact_phone: string;

  @IsString()
  contact_email: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsBoolean()
  can_buy?: boolean;

  @IsOptional()
  @IsBoolean()
  can_sell?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  legal_name?: string;

  @IsOptional()
  @IsString()
  organized_in?: string;

  @IsOptional()
  @IsString()
  contact_name?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsString()
  contact_email?: string;

  @IsOptional()
  @IsString()
  address_line1?: string;

  @IsOptional()
  @IsString()
  address_line2?: string;

  @IsOptional()
  @IsBoolean()
  can_buy?: boolean;

  @IsOptional()
  @IsBoolean()
  can_sell?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CreateIODto {
  @IsString()
  network_id: string;

  @IsIn(['buyer', 'seller'])
  grovlabs_role: 'buyer' | 'seller';

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  lead_type?: string;

  @IsOptional()
  @IsString()
  geo?: string;

  @IsOptional()
  @IsString()
  daily_cap?: string;

  @IsOptional()
  @IsString()
  concurrency?: string;

  @IsOptional()
  @IsString()
  payment_terms?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  compensation_type?: string;

  @IsOptional()
  @IsNumber()
  compensation_amount?: number;

  @IsOptional()
  @IsNumber()
  minimum_duration?: number;

  @IsOptional()
  @IsString()
  hours_of_operation?: string;

  @IsOptional()
  @IsNumber()
  payout_threshold?: number;

  @IsOptional()
  @IsString()
  other_terms?: string;
}

class SignIODto {
  @IsString()
  sign_name: string;

  @IsOptional()
  @IsString()
  sign_title?: string;

  @IsBoolean()
  agree: boolean;
}

@ApiTags('N2N Network Partners')
@Controller('n2n')
export class N2NController {
  private readonly logger = new Logger(N2NController.name);

  constructor(private readonly svc: N2NService) {}

  // ==================== PARTNER MANAGEMENT ====================

  @Get('partners')
  @ApiOperation({ summary: 'List all network partners' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (active, inactive)' })
  async listPartners(@Query('status') status?: string) {
    return this.svc.listPartners(status);
  }

  @Get('partners/:id')
  @ApiOperation({ summary: 'Get network partner details' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  async getPartner(@Param('id') id: string) {
    return this.svc.getPartner(id);
  }

  @Post('partners')
  @ApiOperation({ summary: 'Create a new network partner' })
  async createPartner(@Body() dto: CreatePartnerDto) {
    return this.svc.createPartner(dto);
  }

  @Patch('partners/:id')
  @ApiOperation({ summary: 'Update a network partner' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  async updatePartner(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.svc.updatePartner(id, dto);
  }

  @Delete('partners/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a network partner' })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  async deletePartner(@Param('id') id: string) {
    return this.svc.deletePartner(id);
  }

  // ==================== IO MANAGEMENT ====================

  @Get('ios')
  @ApiOperation({ summary: 'List all network IOs' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'network_id', required: false, description: 'Filter by network partner' })
  async listIOs(
    @Query('status') status?: string,
    @Query('network_id') networkId?: string,
  ) {
    return this.svc.listIOs(status, networkId);
  }

  @Get('ios/:id')
  @ApiOperation({ summary: 'Get IO details' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async getIO(@Param('id') id: string) {
    return this.svc.getIO(id);
  }

  @Post('ios')
  @ApiOperation({ summary: 'Create a new IO for a network partner' })
  async createIO(@Body() dto: CreateIODto) {
    return this.svc.createIO({
      ...dto,
      start_date: dto.start_date ? new Date(dto.start_date) : undefined,
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
    });
  }

  @Patch('ios/:id')
  @ApiOperation({ summary: 'Update an IO' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async updateIO(@Param('id') id: string, @Body() dto: Partial<CreateIODto>) {
    return this.svc.updateIO(id, {
      ...dto,
      start_date: dto.start_date ? new Date(dto.start_date) : undefined,
      end_date: dto.end_date ? new Date(dto.end_date) : undefined,
    });
  }

  @Delete('ios/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an IO' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async deleteIO(@Param('id') id: string) {
    return this.svc.deleteIO(id);
  }

  // ==================== IO SIGNING (public, token-authenticated) ====================

  @Get('io/sign/:token')
  @ApiOperation({ summary: 'Get IO for signing (network partner view)' })
  @ApiParam({ name: 'token', description: 'IO signing token from email' })
  async getIOForSigning(@Param('token') token: string) {
    return this.svc.getIOForSigning(token);
  }

  @Get('io/sign/:token/html')
  @ApiOperation({ summary: 'Get IO as HTML document' })
  @ApiParam({ name: 'token', description: 'IO signing token' })
  async getIOHtml(@Param('token') token: string, @Res() res: Response) {
    const html = await this.svc.generateIOHtml(token);
    res.type('text/html').send(html);
  }

  @Post('io/sign/:token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Network partner signs the IO' })
  @ApiParam({ name: 'token', description: 'IO signing token' })
  async signIO(
    @Param('token') token: string,
    @Body() dto: SignIODto,
    @Req() req: Request,
  ) {
    if (!dto.agree) throw new BadRequestException('You must agree to the IO terms');
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    return this.svc.signIO(token, dto.sign_name, dto.sign_title, ip);
  }

  // ==================== ADMIN: COUNTERSIGNING ====================

  @Post('ios/:id/countersign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin countersigns an IO' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async countersignIO(
    @Param('id') id: string,
    @Body() body: { sign_name: string; sign_title?: string },
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    return this.svc.countersignIO(id, body.sign_name, body.sign_title, ip);
  }

  // ==================== SEND SIGN REQUEST ====================

  @Post('ios/:id/send-sign-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send IO sign request email to network partner' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async sendSignRequest(@Param('id') id: string) {
    return this.svc.sendSignRequestEmail(id);
  }

  // ==================== IO DOWNLOAD ====================

  @Get('ios/:id/download')
  @ApiOperation({ summary: 'Download IO as printable HTML' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async downloadIO(@Param('id') id: string, @Res() res: Response) {
    const html = await this.svc.generateIODownloadHtml(id);
    res.type('text/html').send(html);
  }
}
