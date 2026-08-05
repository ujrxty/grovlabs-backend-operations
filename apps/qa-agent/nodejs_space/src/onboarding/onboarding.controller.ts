import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res, Logger, HttpCode,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service.js';
import { ApplyDto } from './dto/apply.dto.js';
import { ApproveDto, RejectDto, SignIODto, AddCampaignDto } from './dto/review.dto.js';
import { CreateCampaignDto } from './dto/campaign.dto.js';
import type { Request } from 'express';

@ApiTags('Vendor Onboarding')
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly svc: OnboardingService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('campaigns')
  @ApiOperation({ summary: 'List active campaigns', description: 'Public endpoint. Returns all active campaigns available for vendor applications.' })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'Include inactive campaigns (admin)' })
  async listCampaigns(@Query('all') all?: string) {
    return this.svc.listCampaigns(all !== 'true');
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async getCampaign(@Param('id') id: string) {
    return this.svc.getCampaign(id);
  }

  @Post('apply')
  @ApiOperation({
    summary: 'Submit vendor application',
    description: 'Public endpoint. Vendor submits their info and selects one or more campaigns. Returns a status token for tracking.',
  })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Duplicate application' })
  async apply(@Body() dto: ApplyDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    return this.svc.submitApplication(dto, ip);
  }

  @Get('status/:token')
  @ApiOperation({ summary: 'Check application status', description: 'Public endpoint. Vendor checks their application status using the token from confirmation email.' })
  @ApiParam({ name: 'token', description: 'Status token from confirmation email' })
  async checkStatus(@Param('token') token: string) {
    return this.svc.checkStatus(token);
  }

  // ==================== IO ENDPOINTS (public, token-authenticated) ====================

  @Get('io/:signToken')
  @ApiOperation({ summary: 'Get IO for signing', description: 'Public endpoint. Vendor views IO terms before signing. Token is in the approval email link.' })
  @ApiParam({ name: 'signToken', description: 'IO signing token from approval email' })
  async getIO(@Param('signToken') signToken: string) {
    return this.svc.getIOForSigning(signToken);
  }

  @Post('io/:signToken/sign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Vendor signs IO', description: 'Vendor signs the Insertion Order with their legal name.' })
  @ApiParam({ name: 'signToken', description: 'IO signing token' })
  async signIO(@Param('signToken') signToken: string, @Body() dto: SignIODto, @Req() req: Request) {
    if (!dto.agree) throw new BadRequestException('You must agree to the IO terms');
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    return this.svc.signIO(signToken, dto.sign_name, ip);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/applications')
  @ApiOperation({ summary: 'List all applications (admin)', description: 'Admin endpoint. Lists applications with optional status filter.' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'under_review', 'approved', 'rejected', 'withdrawn'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listApplications(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listApplications(status, Number(page) || 1, Number(limit) || 20);
  }

  @Get('admin/applications/:id')
  @ApiOperation({ summary: 'Get application details (admin)' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  async getApplication(@Param('id') id: string) {
    return this.svc.getApplication(id);
  }

  @Post('admin/applications/:id/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Approve application',
    description: 'Approves the application, creates vendor profile, TrackDrive traffic source, and IO. Sends approval email.',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  async approveApplication(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.svc.approveApplication(id, dto.notes, dto.special_terms);
  }

  @Post('admin/applications/:id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject application', description: 'Rejects the application with a reason. Sends rejection email.' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  async rejectApplication(@Param('id') id: string, @Body() dto: RejectDto) {
    return this.svc.rejectApplication(id, dto.reason, dto.details);
  }

  @Post('admin/io/:id/countersign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Countersign IO', description: 'Admin countersigns the IO after vendor has signed. Activates IO and sends welcome email.' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  async countersignIO(@Param('id') id: string) {
    return this.svc.countersignIO(id);
  }

  @Get('admin/vendors')
  @ApiOperation({ summary: 'List vendor profiles', description: 'List all vendor profiles with IO and application counts.' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'paused', 'terminated'] })
  async listVendors(@Query('status') status?: string) {
    return this.svc.listVendors(status);
  }

  @Post('admin/vendors/:vendorId/add-campaign')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add campaign(s) to an existing vendor',
    description:
      'Adds one or more NEW campaigns to a vendor already set up in the system, WITHOUT a new application and WITHOUT a new Lead Purchase Agreement. Issues a single consolidated Insertion Order for the added campaign(s) and emails the vendor the IO sign link. The vendor must already exist and already have a Lead Purchase Agreement on file. Campaigns the vendor already has an active/pending IO for are rejected.',
  })
  @ApiParam({ name: 'vendorId', description: 'Existing vendor profile ID' })
  @ApiResponse({ status: 200, description: 'New IO issued for the added campaign(s)' })
  @ApiResponse({ status: 400, description: 'Validation error (inactive/unknown/duplicate campaign, or vendor has no LPA)' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async addCampaignToVendor(@Param('vendorId') vendorId: string, @Body() dto: AddCampaignDto) {
    return this.svc.addCampaignsToVendor(vendorId, dto.campaign_ids, dto.special_terms);
  }

  @Post('admin/insertion-orders/:id/void')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Void / cancel a pending IO',
    description:
      'Voids a pending Insertion Order (status pending_vendor or pending_counter). Releases the sign token so the old vendor sign link can no longer be used, and voids any attached PENDING Lead Purchase Agreement. An already-active (countersigned) master LPA is preserved. Cannot void an active or already-voided IO.',
  })
  @ApiParam({ name: 'id', description: 'Insertion order ID' })
  @ApiBody({ required: false, schema: { type: 'object', properties: { reason: { type: 'string', example: 'Vendor declined this campaign' } } } })
  @ApiResponse({ status: 200, description: 'IO voided; attached pending LPA (if any) voided' })
  @ApiResponse({ status: 400, description: 'IO is not in a voidable (pending) state' })
  @ApiResponse({ status: 404, description: 'IO not found' })
  async voidInsertionOrder(@Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.svc.voidInsertionOrder(id, body?.reason);
  }

  @Get('admin/ios')
  @ApiOperation({ summary: 'List insertion orders', description: 'List all IOs with optional status filter.' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending_vendor', 'pending_counter', 'active', 'terminated'] })
  async listIOs(@Query('status') status?: string) {
    const where = status ? { status } : {};
    return (this.svc as any).prisma.insertion_order.findMany({
      where,
      include: {
        vendor: { select: { company_name: true, email: true } },
        campaign: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ==================== CAMPAIGN MANAGEMENT ====================

  @Post('admin/campaigns')
  @ApiOperation({ summary: 'Create campaign', description: 'Admin endpoint. Creates a new campaign.' })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.svc.createCampaign(dto);
  }

  @Patch('admin/campaigns/:id')
  @ApiOperation({ summary: 'Update campaign', description: 'Admin endpoint. Updates any campaign fields (name, payout, hours, geo, etc.).' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async updateCampaign(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCampaign(id, dto);
  }

  @Post('admin/campaigns/:id/toggle')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate or deactivate a campaign', description: 'Sets is_active to true or false. Deactivated campaigns are hidden from vendors.' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiBody({ schema: { type: 'object', properties: { is_active: { type: 'boolean' } }, required: ['is_active'] } })
  async toggleCampaign(@Param('id') id: string, @Body() body: { is_active: boolean }) {
    return this.svc.toggleCampaign(id, body.is_active);
  }

  @Delete('admin/campaigns/:id')
  @ApiOperation({ summary: 'Delete campaign', description: 'Permanently deletes a campaign. Fails if it has any applications — deactivate instead.' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async deleteCampaign(@Param('id') id: string) {
    return this.svc.deleteCampaign(id);
  }

  @Get('admin/campaigns')
  @ApiOperation({ summary: 'List all campaigns (admin)', description: 'Lists ALL campaigns including inactive ones. For admin management.' })
  async listAllCampaigns() {
    return this.svc.listCampaigns(false);
  }

  // ==================== AGREEMENT PUBLIC ENDPOINTS ====================

  @Get('agreement/:signToken')
  @ApiOperation({ summary: 'View Lead Purchase Agreement for signing', description: 'Public endpoint. Vendor views the agreement using the sign token.' })
  @ApiParam({ name: 'signToken', description: 'Agreement sign token' })
  async getAgreement(@Param('signToken') signToken: string) {
    return this.svc.getAgreementForSigning(signToken);
  }

  @Post('agreement/:signToken/sign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign Lead Purchase Agreement', description: 'Public endpoint. Vendor signs the agreement.' })
  @ApiParam({ name: 'signToken', description: 'Agreement sign token' })
  @ApiBody({ schema: { type: 'object', properties: { sign_name: { type: 'string' } }, required: ['sign_name'] } })
  @ApiResponse({ status: 200, description: 'Agreement signed' })
  async signAgreement(@Param('signToken') signToken: string, @Body() body: { sign_name: string }, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';
    return this.svc.signAgreement(signToken, body.sign_name, ip);
  }

  // ==================== AGREEMENT ADMIN ENDPOINTS ====================

  @Get('admin/agreements')
  @ApiOperation({ summary: 'List Lead Purchase Agreements', description: 'List all agreements with optional status filter.' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending_vendor', 'pending_counter', 'active', 'terminated'] })
  async listAgreements(@Query('status') status?: string) {
    return this.svc.listAgreements(status);
  }

  @Post('admin/agreement/:id/countersign')
  @HttpCode(200)
  @ApiOperation({ summary: 'Countersign Lead Purchase Agreement', description: 'Admin countersigns the agreement after vendor has signed.' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async countersignAgreement(@Param('id') id: string) {
    return this.svc.countersignAgreement(id);
  }

  @Get('admin/agreement/:id/download')
  @ApiOperation({ summary: 'Download Lead Purchase Agreement as printable HTML', description: 'Returns a professionally formatted HTML page for the signed agreement.' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  @ApiResponse({ status: 200, description: 'HTML document' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  async downloadAgreementById(@Param('id') id: string, @Res() res: Response) {
    try {
      const html = await this.svc.getAgreementDownloadHtml(id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  // ==================== IO DOWNLOAD ====================

  @Get('admin/io/:id/download')
  @ApiOperation({ summary: 'Download IO as printable HTML', description: 'Returns a professionally formatted HTML page for the IO that can be printed or saved as PDF.' })
  @ApiParam({ name: 'id', description: 'IO ID' })
  @ApiResponse({ status: 200, description: 'HTML document' })
  @ApiResponse({ status: 404, description: 'IO not found' })
  async downloadIO(@Param('id') id: string, @Res() res: Response) {
    try {
      const html = await this.svc.getIODownloadHtml(id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (e: any) {
      throw new NotFoundException(e.message);
    }
  }

  // ==================== WEBHOOK: External app notifications ====================

  @Post('webhook/application-created')
  @ApiOperation({ summary: 'Webhook: notify Telegram about new application(s) created by external app' })
  @ApiBody({ schema: { type: 'object', properties: { application_ids: { type: 'array', items: { type: 'string' } } }, required: ['application_ids'] } })
  async webhookApplicationCreated(@Body() body: { application_ids: string[] }) {
    return this.svc.handleApplicationWebhook(body.application_ids);
  }

  @Post('webhook/io-signed')
  @ApiOperation({ summary: 'Webhook: notify Telegram that a vendor signed their IO (ready for countersign)' })
  @ApiBody({ schema: { type: 'object', properties: { io_id: { type: 'string' } }, required: ['io_id'] } })
  async webhookIOSigned(@Body() body: { io_id: string }) {
    return this.svc.handleIOSignedWebhook(body.io_id);
  }

  @Post('webhook/agreement-signed')
  @ApiOperation({ summary: 'Webhook: notify Telegram that a vendor signed their Lead Purchase Agreement (ready for countersign)' })
  @ApiBody({ schema: { type: 'object', properties: { agreement_id: { type: 'string' } }, required: ['agreement_id'] } })
  async webhookAgreementSigned(@Body() body: { agreement_id: string }) {
    return this.svc.handleAgreementSignedWebhook(body.agreement_id);
  }
}
