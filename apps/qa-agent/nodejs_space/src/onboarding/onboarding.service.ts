import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { IOService } from './io.service.js';
import { OnboardingNotificationService } from './notification.service.js';
import { DiscordService } from '../discord/discord.service.js';
import { ApplyDto } from './dto/apply.dto.js';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly td: TrackDriveService,
    private readonly io: IOService,
    private readonly notif: OnboardingNotificationService,
    private readonly config: ConfigService,
    private readonly discord: DiscordService,
  ) {}

  // ==================== CAMPAIGNS ====================

  async listCampaigns(activeOnly = true) {
    const where = activeOnly ? { is_active: true } : {};
    return this.prisma.campaign.findMany({
      where,
      orderBy: [{ sort_order: 'asc' }, { industry: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, industry: true, call_type: true, description: true,
        payout: true, payout_type: true, billing_cycle: true, min_duration: true,
        geographic_focus: true, allowed_traffic: true, restricted_traffic: true,
        requirements: true, compliance_notes: true, is_active: true, sort_order: true,
      },
    });
  }

  async getCampaign(id: string) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async createCampaign(data: any) {
    return this.prisma.campaign.create({ data });
  }

  async updateCampaign(id: string, data: any) {
    await this.getCampaign(id);
    return this.prisma.campaign.update({ where: { id }, data });
  }

  async toggleCampaign(id: string, isActive: boolean) {
    await this.getCampaign(id);
    return this.prisma.campaign.update({ where: { id }, data: { is_active: isActive } });
  }

  async deleteCampaign(id: string) {
    const campaign = await this.getCampaign(id);
    // Check if any applications exist for this campaign
    const appCount = await this.prisma.vendor_application.count({ where: { campaign_id: id } });
    if (appCount > 0) {
      throw new BadRequestException(`Cannot delete campaign "${campaign.name}" — it has ${appCount} application(s). Deactivate it instead.`);
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { message: `Campaign "${campaign.name}" deleted` };
  }

  // ==================== APPLICATION SUBMISSION ====================

  async submitApplication(dto: ApplyDto, ip: string) {
    // Validate campaigns exist and are active
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: dto.campaign_ids }, is_active: true },
    });
    if (campaigns.length === 0) {
      throw new BadRequestException('No valid active campaigns selected');
    }
    const invalidIds = dto.campaign_ids.filter(id => !campaigns.find(c => c.id === id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Some campaigns are invalid or inactive: ${invalidIds.join(', ')}`);
    }

    if (!dto.tcpa_agreed || !dto.terms_agreed) {
      throw new BadRequestException('You must agree to TCPA compliance and terms to apply');
    }

    // Check for duplicate: same email + same campaign + pending/approved
    const existing = await this.prisma.vendor_application.findMany({
      where: {
        email: dto.email.toLowerCase().trim(),
        campaign_id: { in: dto.campaign_ids },
        status: { in: ['pending', 'under_review', 'approved'] },
      },
      include: { campaign: true },
    });
    if (existing.length > 0) {
      const dupCampaigns = existing.map(e => e.campaign.name).join(', ');
      throw new ConflictException(
        `You already have an active application for: ${dupCampaigns}. Check your status with the token from your confirmation email.`,
      );
    }

    // Generate group token to link multi-campaign apps
    const groupToken = randomBytes(8).toString('hex');
    const statusToken = randomBytes(6).toString('hex'); // shared status token for the group

    // Create one application per campaign
    const apps: any[] = [];
    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i];
      const appRecord = await this.prisma.vendor_application.create({
        data: {
          company_name: dto.company_name.trim(),
          contact_name: dto.contact_name.trim(),
          email: dto.email.toLowerCase().trim(),
          phone: dto.phone.trim(),
          website: dto.website?.trim() || null,
          traffic_types: dto.traffic_types.trim(),
          estimated_volume: dto.estimated_volume?.trim() || null,
          experience: dto.experience?.trim() || null,
          referred_by: dto.referred_by?.trim() || null,
          comments: dto.comments?.trim() || null,
          campaign_id: campaign.id,
          tcpa_agreed: dto.tcpa_agreed,
          terms_agreed: dto.terms_agreed,
          agreed_ip: ip,
          agreed_at: new Date(),
          status_token: campaigns.length > 1
            ? `${statusToken}-${i + 1}`
            : statusToken,
          group_token: groupToken,
        },
        include: { campaign: true },
      });
      apps.push(appRecord);
    }

    this.logger.log(`New application: ${dto.company_name} for ${campaigns.map(c => c.name).join(', ')}`);

    // Send Telegram notification with inline buttons
    this.sendTelegramApplicationAlert(apps, dto).catch(e =>
      this.logger.error(`Telegram alert failed: ${e.message}`),
    );

    // Emails disabled — portal handles all vendor notifications

    return {
      message: 'Application submitted successfully',
      status_token: statusToken,
      campaigns_applied: campaigns.map(c => c.name),
      application_count: apps.length,
    };
  }

  // ==================== STATUS CHECK ====================

  async checkStatus(token: string) {
    // Try exact match first
    let apps = await this.prisma.vendor_application.findMany({
      where: { status_token: token },
      include: { campaign: { select: { name: true, industry: true } } },
      orderBy: { created_at: 'asc' },
    });

    // If single token, also find group siblings
    if (apps.length === 1 && apps[0].group_token) {
      apps = await this.prisma.vendor_application.findMany({
        where: { group_token: apps[0].group_token },
        include: { campaign: { select: { name: true, industry: true } } },
        orderBy: { created_at: 'asc' },
      });
    }

    // Also try matching as base token for multi-campaign
    if (apps.length === 0) {
      apps = await this.prisma.vendor_application.findMany({
        where: { status_token: { startsWith: token } },
        include: { campaign: { select: { name: true, industry: true } } },
        orderBy: { created_at: 'asc' },
      });
    }

    if (apps.length === 0) {
      throw new NotFoundException('No application found for this token. Check your confirmation email for the correct link.');
    }

    return {
      company_name: apps[0].company_name,
      contact_name: apps[0].contact_name,
      submitted_at: apps[0].created_at,
      applications: apps.map(a => ({
        campaign: a.campaign.name,
        industry: a.campaign.industry,
        status: a.status,
        status_reason: a.status === 'rejected' ? a.status_reason : undefined,
        reviewed_at: a.reviewed_at,
      })),
    };
  }

  // ==================== ADMIN REVIEW ====================

  async listApplications(status?: string, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [apps, total] = await Promise.all([
      this.prisma.vendor_application.findMany({
        where,
        include: { campaign: { select: { name: true, industry: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vendor_application.count({ where }),
    ]);
    return { applications: apps, total, page, pages: Math.ceil(total / limit) };
  }

  async getApplication(id: string) {
    const app = await this.prisma.vendor_application.findUnique({
      where: { id },
      include: { campaign: true, vendor: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async approveApplication(id: string, notes?: string, specialTerms?: string) {
    const app = await this.getApplication(id);
    if (app.status !== 'pending' && app.status !== 'under_review') {
      throw new BadRequestException(`Cannot approve: application is ${app.status}`);
    }

    // Find or create vendor profile (NO TrackDrive yet — created after both docs are countersigned)
    let vendor = await this.prisma.vendor_profile.findUnique({
      where: { email: app.email },
    });

    if (!vendor) {
      vendor = await this.prisma.vendor_profile.create({
        data: {
          company_name: app.company_name,
          contact_name: app.contact_name,
          email: app.email,
          phone: app.phone,
          website: app.website,
          company_address: app.company_address,
          company_state: app.company_state,
          company_country: app.company_country,
          entity_type: app.entity_type,
          status: 'active',
        },
      });
    }

    // Update application
    await this.prisma.vendor_application.update({
      where: { id },
      data: {
        status: 'approved',
        status_reason: notes || 'Approved',
        reviewed_at: new Date(),
        reviewed_by: 'admin',
        vendor_id: vendor.id,
      },
    });

    // ---- Group-aware bundling ----
    // If sibling campaigns from the SAME application group were already approved,
    // there is an existing unsigned (pending_vendor) IO for this vendor covering
    // only campaigns from this group. Bundle this campaign into that IO instead of
    // creating a new one. This makes individual approvals accumulate into ONE IO,
    // matching the "Approve All" behavior.
    const bundleIo = await this.findGroupBundleIO(vendor.id, app.group_token);

    let ioRecord: any;
    if (bundleIo) {
      ioRecord = await this.io.addCampaignsToExistingIO(bundleIo.id, [app.campaign_id], specialTerms);
    } else {
      ioRecord = await this.io.createIO(vendor.id, app.campaign_id, specialTerms);
    }

    // Lead Purchase Agreement: ONE master LPA per vendor. Only create it if the
    // vendor does not already have one (from an earlier approval in this group or
    // a previous onboarding).
    let agreement = await this.prisma.lead_purchase_agreement.findFirst({
      where: { vendor_id: vendor.id },
      orderBy: { created_at: 'asc' },
    });
    if (!agreement) {
      agreement = await this.io.createAgreement(ioRecord.id, vendor.id);
    }

    // Link to the vendor portal UI for IO signing, NOT this API service
    const portalOrigin = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3000');
    const ioSignUrl = new URL(
      `/io/sign/${ioRecord.sign_token}`,
      portalOrigin,
    ).toString();

    // Notify portal to send approval email
    this.callPortalWebhook('/api/onboarding/webhook/application-approved', { vendor_id: vendor.id })
      .catch(e => this.logger.error(`Portal approval webhook failed: ${e.message}`));

    this.logger.log(
      `Application approved: ${app.company_name} for ${app.campaign.name} (${bundleIo ? 'bundled into' : 'new'} IO ${ioRecord.io_number})`,
    );

    return {
      message: 'Application approved',
      vendor_id: vendor.id,
      io_number: ioRecord.io_number,
      io_sign_url: ioSignUrl,
      agreement_sign_token: agreement?.sign_token || null,
    };
  }

  /**
   * Find an existing unsigned (pending_vendor) IO for the vendor that belongs to the
   * same application group — i.e. every campaign on the IO is part of that group's
   * campaign set. Returns null if none (first approval in the group, or no group).
   */
  private async findGroupBundleIO(vendorId: string, groupToken?: string | null): Promise<any | null> {
    if (!groupToken) return null;

    const groupApps = await this.prisma.vendor_application.findMany({
      where: { group_token: groupToken },
      select: { campaign_id: true },
    });
    const groupCampaignIds = new Set(groupApps.map(a => a.campaign_id));
    if (groupCampaignIds.size === 0) return null;

    const pendingIos = await this.prisma.insertion_order.findMany({
      where: { vendor_id: vendorId, status: 'pending_vendor' },
      orderBy: { created_at: 'desc' },
    });

    for (const io of pendingIos) {
      let cids: string[] = [];
      if (io.campaign_ids) {
        try {
          const parsed = JSON.parse(io.campaign_ids);
          if (Array.isArray(parsed)) cids = parsed;
        } catch {
          /* ignore */
        }
      }
      if (cids.length === 0 && io.campaign_id) cids = [io.campaign_id];
      // An IO belongs to this group only if all its campaigns are within the group set
      if (cids.length > 0 && cids.every(c => groupCampaignIds.has(c))) {
        return io;
      }
    }
    return null;
  }

  async rejectApplication(id: string, reason: string, details?: string) {
    const app = await this.getApplication(id);
    if (app.status !== 'pending' && app.status !== 'under_review') {
      throw new BadRequestException(`Cannot reject: application is ${app.status}`);
    }

    const reasonText = details || reason;
    await this.prisma.vendor_application.update({
      where: { id },
      data: {
        status: 'rejected',
        status_reason: reasonText,
        reviewed_at: new Date(),
        reviewed_by: 'admin',
      },
    });

    // Notify portal to send rejection email
    this.callPortalWebhook('/api/onboarding/webhook/application-rejected', { vendor_id: app.vendor_id || app.id, application_id: app.id, reason: reasonText })
      .catch(e => this.logger.error(`Portal rejection webhook failed: ${e.message}`));

    this.logger.log(`Application rejected: ${app.company_name} for ${app.campaign.name} (${reason})`);

    return { message: 'Application rejected', reason: reasonText };
  }

  // ==================== IO SIGNING ====================

  async getIOForSigning(signToken: string) {
    const ioRecord = await this.io.getBySignToken(signToken);
    if (!ioRecord) throw new NotFoundException('Insertion Order not found');
    return {
      io_number: ioRecord.io_number,
      status: ioRecord.status,
      vendor: ioRecord.vendor.company_name,
      campaign: ioRecord.campaign.name,
      payout: Number(ioRecord.payout),
      payout_type: ioRecord.payout_type,
      billing_cycle: ioRecord.billing_cycle,
      min_duration: ioRecord.min_duration,
      terms: ioRecord.terms,
      special_terms: ioRecord.special_terms,
      vendor_signed_at: ioRecord.vendor_signed_at,
      counter_signed_at: ioRecord.counter_signed_at,
    };
  }

  async signIO(signToken: string, signName: string, ip: string) {
    const ioRecord = await this.io.vendorSign(signToken, signName, ip);

    // Notify admin via Telegram
    this.sendTelegramIOSignedAlert(ioRecord).catch(e =>
      this.logger.error(`Telegram IO alert failed: ${e.message}`),
    );

    // Find the linked Lead Purchase Agreement so the vendor can sign it next
    const agreement = await this.io.getAgreementByIOId(ioRecord.id);
    const portalOrigin = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3000');
    const agreementSignUrl = agreement
      ? new URL(`/agreement/sign/${agreement.sign_token}`, portalOrigin).toString()
      : null;

    return {
      message: 'IO signed successfully. Please proceed to sign the Lead Purchase Agreement.',
      io_number: ioRecord.io_number,
      agreement_sign_url: agreementSignUrl,
      agreement_sign_token: agreement?.sign_token || null,
    };
  }

  /** Approve multiple applications at once, creating ONE consolidated IO */
  async approveAllApplications(apps: any[], specialTerms?: string) {
    const first = apps[0];

    // Find or create vendor profile (NO TrackDrive yet — created after both docs are countersigned)
    let vendor = await this.prisma.vendor_profile.findUnique({
      where: { email: first.email },
    });

    if (!vendor) {
      vendor = await this.prisma.vendor_profile.create({
        data: {
          company_name: first.company_name,
          contact_name: first.contact_name,
          email: first.email,
          phone: first.phone,
          website: first.website,
          company_address: first.company_address,
          company_state: first.company_state,
          company_country: first.company_country,
          entity_type: first.entity_type,
          status: 'active',
        },
      });
    }

    // Create ONE consolidated IO for all campaigns
    const campaignIds = apps.map(a => a.campaign_id);
    const ioRecord = await this.io.createMultiCampaignIO(vendor.id, campaignIds, specialTerms);

    // Lead Purchase Agreement: ONE master LPA per vendor. Reuse an existing one if present.
    let agreement = await this.prisma.lead_purchase_agreement.findFirst({
      where: { vendor_id: vendor.id },
      orderBy: { created_at: 'asc' },
    });
    if (!agreement) {
      agreement = await this.io.createAgreement(ioRecord.id, vendor.id);
    }

    // Update all applications to approved, link to vendor
    for (const app of apps) {
      await this.prisma.vendor_application.update({
        where: { id: app.id },
        data: {
          status: 'approved',
          status_reason: 'Approved',
          reviewed_at: new Date(),
          reviewed_by: 'admin',
          vendor_id: vendor.id,
        },
      });
    }

    // IO sign URL pointing to vendor portal
    const portalOrigin = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3000');
    const ioSignUrl = new URL(`/io/sign/${ioRecord.sign_token}`, portalOrigin).toString();

    // Notify portal to send approval email
    this.callPortalWebhook('/api/onboarding/webhook/application-approved', { vendor_id: vendor.id })
      .catch(e => this.logger.error(`Portal approval webhook failed: ${e.message}`));

    const campaignNames = apps.map(a => a.campaign.name);
    this.logger.log(`All ${apps.length} applications approved for ${first.company_name}: ${campaignNames.join(', ')}`);

    return {
      message: 'All applications approved',
      vendor_id: vendor.id,
      io_number: ioRecord.io_number,
      io_sign_url: ioSignUrl,
      agreement_sign_token: agreement?.sign_token || null,
      campaigns: campaignNames,
    };
  }

  /**
   * Add one or more NEW campaigns to an EXISTING vendor without a new application.
   * The vendor must already exist and already have a Lead Purchase Agreement on file
   * (the LPA is the master contract, signed once per vendor). This only issues ONE
   * consolidated Insertion Order for the new campaign(s) — NO new LPA is generated.
   */
  async addCampaignsToVendor(vendorId: string, campaignIds: string[], specialTerms?: string) {
    // ---- Validate vendor exists (feature is ONLY for already-onboarded vendors) ----
    const vendor = await this.prisma.vendor_profile.findUnique({
      where: { id: vendorId },
      include: {
        lead_purchase_agreements: true,
        insertion_orders: true,
      },
    });
    if (!vendor) {
      throw new NotFoundException('Vendor not found. This feature is only for vendors already set up in the system.');
    }

    // ---- Vendor must already have a Lead Purchase Agreement (master contract) ----
    if (!vendor.lead_purchase_agreements || vendor.lead_purchase_agreements.length === 0) {
      throw new BadRequestException(
        'This vendor has no Lead Purchase Agreement on file yet. Use the standard application/approval flow first so the master agreement gets signed.',
      );
    }

    // ---- Validate campaign selection ----
    const ids = Array.from(new Set((campaignIds || []).filter(Boolean)));
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one campaign to add.');
    }

    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: ids } },
    });
    const foundIds = campaigns.map(c => c.id);
    const missing = ids.filter(id => !foundIds.includes(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown campaign id(s): ${missing.join(', ')}`);
    }
    const inactive = campaigns.filter(c => !c.is_active).map(c => c.name);
    if (inactive.length > 0) {
      throw new BadRequestException(`These campaigns are inactive: ${inactive.join(', ')}. Activate them first.`);
    }

    // ---- Prevent adding a campaign the vendor already has a live/pending IO for ----
    const activeIoStatuses = ['pending_vendor', 'pending_counter', 'active'];
    const alreadyCovered = new Set<string>();
    for (const io of vendor.insertion_orders) {
      if (!activeIoStatuses.includes(io.status)) continue;
      let ioCampaignIds: string[] = [];
      if (io.campaign_ids) {
        try {
          const parsed = JSON.parse(io.campaign_ids);
          if (Array.isArray(parsed)) ioCampaignIds = parsed;
        } catch {
          /* ignore malformed */
        }
      }
      if (ioCampaignIds.length === 0 && io.campaign_id) ioCampaignIds = [io.campaign_id];
      ioCampaignIds.forEach(cid => alreadyCovered.add(cid));
    }
    const duplicates = campaigns.filter(c => alreadyCovered.has(c.id)).map(c => c.name);
    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Vendor already has an active or pending IO for: ${duplicates.join(', ')}. Nothing to add for those.`,
      );
    }

    // ---- Create ONE consolidated IO for all the new campaigns. NO new LPA. ----
    const ioRecord = await this.io.createMultiCampaignIO(vendor.id, ids, specialTerms);

    // IO sign URL pointing to the vendor portal
    const portalOrigin = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3000');
    const ioSignUrl = new URL(`/io/sign/${ioRecord.sign_token}`, portalOrigin).toString();

    // Notify portal to email the vendor the IO sign link (reuses approval email path)
    this.callPortalWebhook('/api/onboarding/webhook/application-approved', { vendor_id: vendor.id })
      .catch(e => this.logger.error(`Portal add-campaign webhook failed: ${e.message}`));

    // Telegram alert to the ops group
    this.sendTelegramAddCampaignAlert(vendor, campaigns, ioRecord).catch(e =>
      this.logger.error(`Telegram add-campaign alert failed: ${e.message}`),
    );

    const campaignNames = campaigns.map(c => c.name);
    this.logger.log(`Added campaigns to existing vendor ${vendor.company_name}: ${campaignNames.join(', ')} (IO ${ioRecord.io_number})`);

    return {
      message: 'New IO issued for added campaign(s). No new Lead Purchase Agreement required.',
      vendor_id: vendor.id,
      io_id: ioRecord.id,
      io_number: ioRecord.io_number,
      io_sign_url: ioSignUrl,
      campaigns: campaignNames,
    };
  }

  private async sendTelegramAddCampaignAlert(vendor: any, campaigns: any[], io: any): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) return;

    const campaignLines = campaigns.map(c => `  ${this.esc(c.name)}`).join('\n');
    let msg = `<b>Campaign(s) Added to Existing Vendor</b>\n\n`;
    msg += `<b>${this.esc(vendor.company_name)}</b>\n`;
    msg += `${this.esc(vendor.email)}\n`;
    msg += `\n<b>New campaign(s):</b>\n${campaignLines}\n`;
    msg += `\nIO: ${io.io_number}\n`;
    msg += `No new Lead Purchase Agreement needed — IO sign link has been emailed to the vendor.`;

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }

  /**
   * Void/cancel a pending IO. Releases its sign token (old vendor link stops working)
   * and voids any attached PENDING Lead Purchase Agreement. An already-active
   * (countersigned) master LPA is preserved.
   */
  async voidInsertionOrder(ioId: string, reason?: string) {
    try {
      const result = await this.io.voidIO(ioId, reason);
      return {
        message: 'Insertion order voided',
        ...result,
      };
    } catch (e: any) {
      const msg = e?.message || 'Failed to void IO';
      if (msg.includes('not found')) throw new NotFoundException(msg);
      throw new BadRequestException(msg);
    }
  }

  async countersignIO(ioId: string, signBy = 'UJ, CEO - GrovLabs Inc') {
    const ioRecord = await this.io.counterSign(ioId, signBy);

    // Check if the linked agreement is also countersigned — if so, finalize onboarding
    await this.checkAndFinalizeOnboarding(ioRecord.id, ioRecord.vendor_id);

    // Send Discord notification
    this.discord.sendIOCountersignedNotification({
      companyName: ioRecord.vendor.company_name,
      campaignName: ioRecord.campaign.name,
      ioNumber: ioRecord.io_number,
    }).catch(e => this.logger.error(`Discord countersign notification failed: ${e.message}`));

    return {
      message: 'IO countersigned and activated',
      io_number: ioRecord.io_number,
      vendor: ioRecord.vendor.company_name,
      campaign: ioRecord.campaign.name,
    };
  }

  async resendIOEmail(ioId: string) {
    const io = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: {
        vendor: { select: { company_name: true, contact_name: true, email: true } },
        campaign: { select: { name: true } },
      },
    });

    if (!io) {
      throw new NotFoundException('IO not found');
    }

    if (io.status !== 'pending_vendor') {
      throw new BadRequestException('IO is not pending vendor signature');
    }

    const portalUrl = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3000');
    const signUrl = `${portalUrl}/sign-io/${io.sign_token}`;

    await this.notif.sendApplicationApproved(
      io.vendor.email,
      io.vendor.contact_name,
      io.campaign.name,
      signUrl,
    );

    this.logger.log(`Resent IO email for ${io.io_number} to ${io.vendor.email}`);

    return {
      message: 'IO email resent successfully',
      io_number: io.io_number,
      email: io.vendor.email,
    };
  }

  // ==================== VENDORS LIST ====================

  async listVendors(status?: string) {
    const where = status ? { status } : {};
    return this.prisma.vendor_profile.findMany({
      where,
      include: {
        insertion_orders: {
          select: { io_number: true, status: true, campaign: { select: { name: true } } },
        },
        _count: { select: { applications: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ==================== TELEGRAM NOTIFICATIONS ====================

  private async sendTelegramApplicationAlert(apps: any[], dto: ApplyDto): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) return;

    const campaignLines = apps.map(a => `  ${a.campaign.name}`).join('\n');
    const appIds = apps.map(a => a.id);

    let msg = `<b>New Vendor Application</b>\n\n`;
    msg += `<b>${this.esc(dto.company_name)}</b>\n`;
    msg += `${this.esc(dto.contact_name)}\n`;
    msg += `${this.esc(dto.email)} | ${this.esc(dto.phone)}\n`;
    if (dto.website) msg += `${this.esc(dto.website)}\n`;
    msg += `\nTraffic: ${this.esc(dto.traffic_types)}`;
    if (dto.estimated_volume) msg += ` | Vol: ${this.esc(dto.estimated_volume)}`;
    if (dto.referred_by) msg += `\nReferred by: ${this.esc(dto.referred_by)}`;
    if (dto.experience) msg += `\n\nExperience: ${this.esc(dto.experience.substring(0, 200))}`;
    if (dto.comments) msg += `\n\nComments: ${this.esc(dto.comments.substring(0, 200))}`;
    msg += `\n\n<b>Campaigns (${apps.length}):</b>\n${campaignLines}`;

    // Build inline keyboard — one row per campaign with Approve/Reject
    const keyboard: any[][] = [];
    for (const app of apps) {
      const shortId = app.id.substring(0, 8);
      keyboard.push([
        { text: `Approve: ${app.campaign.name}`, callback_data: `oa_${shortId}` },
        { text: `Reject`, callback_data: `or_${shortId}` },
      ]);
    }
    // If multiple, add approve/reject all
    if (apps.length > 1) {
      const groupId = apps[0].group_token.substring(0, 8);
      keyboard.push([
        { text: 'Approve All', callback_data: `oaa_${groupId}` },
        { text: 'Reject All', callback_data: `ora_${groupId}` },
      ]);
    }

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private async sendTelegramIOSignedAlert(io: any): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) return;

    const shortId = io.id.substring(0, 8);
    let msg = `<b>IO Signed by Vendor</b>\n\n`;
    msg += `<b>${this.esc(io.vendor.company_name)}</b>\n`;
    msg += `Campaign: ${this.esc(io.campaign.name)}\n`;
    msg += `IO: ${io.io_number}\n`;
    msg += `Signed by: ${this.esc(io.vendor_sign_name)} (${io.vendor_sign_ip})\n`;
    msg += `\nReady for countersignature.`;

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Countersign', callback_data: `ocs_${shortId}` },
        ]],
      },
    });
  }

  // ==================== TELEGRAM CALLBACK HANDLER ====================

  async handleCallback(callbackId: string, data: string, chatId: string): Promise<string> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');

    try {
      if (data.startsWith('oa_')) {
        // Approve single application
        const shortId = data.substring(3);
        const app = await this.findAppByShortId(shortId);
        if (!app) return 'Application not found';
        if (app.status !== 'pending' && app.status !== 'under_review') return `Already ${app.status}`;
        const result = await this.approveApplication(app.id);
        return `Approved: ${app.company_name} for ${app.campaign.name}\nIO: ${result.io_number}`;

      } else if (data.startsWith('or_')) {
        // Show rejection reasons
        const shortId = data.substring(3);
        const keyboard = [
          [{ text: 'Wrong Traffic Type', callback_data: `orr_${shortId}_traffic_type` }],
          [{ text: 'Volume Too Low', callback_data: `orr_${shortId}_low_volume` }],
          [{ text: 'Compliance Concerns', callback_data: `orr_${shortId}_compliance` }],
          [{ text: 'Duplicate Application', callback_data: `orr_${shortId}_duplicate` }],
          [{ text: 'Other', callback_data: `orr_${shortId}_other` }],
        ];
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: 'Select rejection reason:',
          reply_markup: { inline_keyboard: keyboard },
        });
        return '';

      } else if (data.startsWith('orr_')) {
        // Execute rejection with reason
        const parts = data.substring(4).split('_');
        const shortId = parts[0];
        const reason = parts.slice(1).join('_');
        const app = await this.findAppByShortId(shortId);
        if (!app) return 'Application not found';
        if (app.status !== 'pending' && app.status !== 'under_review') return `Already ${app.status}`;
        await this.rejectApplication(app.id, reason);
        return `Rejected: ${app.company_name} for ${app.campaign.name} (${reason})`;

      } else if (data.startsWith('oaa_')) {
        // Approve all in group — create ONE consolidated IO
        const groupShort = data.substring(4);
        const apps = await this.findAppsByGroupShort(groupShort);
        const pendingApps = apps.filter(a => a.status === 'pending' || a.status === 'under_review');
        if (pendingApps.length === 0) return 'No pending applications to approve';
        const result = await this.approveAllApplications(pendingApps);
        const campaignNames = pendingApps.map(a => a.campaign.name).join(', ');
        return `Approved all (${pendingApps.length} campaigns):\n${campaignNames}\nIO: ${result.io_number}`;

      } else if (data.startsWith('ora_')) {
        // Reject all in group
        const groupShort = data.substring(4);
        const keyboard = [
          [{ text: 'Wrong Traffic Type', callback_data: `orag_${groupShort}_traffic_type` }],
          [{ text: 'Volume Too Low', callback_data: `orag_${groupShort}_low_volume` }],
          [{ text: 'Compliance Concerns', callback_data: `orag_${groupShort}_compliance` }],
          [{ text: 'Other', callback_data: `orag_${groupShort}_other` }],
        ];
        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          chat_id: chatId,
          text: 'Select rejection reason for all:',
          reply_markup: { inline_keyboard: keyboard },
        });
        return '';

      } else if (data.startsWith('orag_')) {
        // Execute reject all with reason
        const parts = data.substring(5).split('_');
        const groupShort = parts[0];
        const reason = parts.slice(1).join('_');
        const apps = await this.findAppsByGroupShort(groupShort);
        let count = 0;
        for (const app of apps) {
          if (app.status === 'pending' || app.status === 'under_review') {
            await this.rejectApplication(app.id, reason);
            count++;
          }
        }
        return count > 0 ? `Rejected ${count} applications (${reason})` : 'No pending applications';

      } else if (data.startsWith('ocs_')) {
        // Countersign IO
        const shortId = data.substring(4);
        const ioRecord = await this.findIOByShortId(shortId);
        if (!ioRecord) return 'IO not found';
        if (ioRecord.status !== 'pending_counter') return `IO status: ${ioRecord.status}`;
        const result = await this.countersignIO(ioRecord.id, 'GrovLabs Inc');
        return `Countersigned: ${result.io_number}\n${result.vendor} — ${result.campaign}\nWelcome email sent.`;

      } else if (data.startsWith('acs_')) {
        // Countersign Lead Purchase Agreement
        const shortId = data.substring(4);
        const agreement = await this.findAgreementByShortId(shortId);
        if (!agreement) return 'Agreement not found';
        if (agreement.status !== 'pending_counter') return `Agreement status: ${agreement.status}`;
        const result = await this.countersignAgreement(agreement.id, 'GrovLabs Inc');
        return `Agreement Countersigned\n${result.vendor} — IO ${result.io_number}`;
      }

      return 'Unknown action';
    } catch (e: any) {
      this.logger.error(`Callback error: ${e.message}`);
      return `Error: ${e.message}`;
    }
  }

  // ==================== HELPERS ====================

  private async findAppByShortId(shortId: string) {
    const apps = await this.prisma.vendor_application.findMany({
      where: { id: { startsWith: shortId } },
      include: { campaign: true },
    });
    return apps[0] || null;
  }

  private async findAppsByGroupShort(groupShort: string) {
    return this.prisma.vendor_application.findMany({
      where: { group_token: { startsWith: groupShort } },
      include: { campaign: true },
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * After either IO or Agreement is countersigned, check if BOTH are done.
   * If both are fully executed: create TrackDrive source + send welcome email.
   */
  private async checkAndFinalizeOnboarding(ioId: string, vendorId: string): Promise<void> {
    const ioRecord = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: { vendor: true, campaign: true },
    });
    const agreement = await this.prisma.lead_purchase_agreement.findFirst({
      where: { io_id: ioId },
    });

    if (!ioRecord) return;

    // Both must be active (countersigned)
    if (ioRecord.status !== 'active') {
      this.logger.log(`Onboarding not finalized: IO ${ioRecord.io_number} status is ${ioRecord.status}`);
      return;
    }
    if (!agreement || agreement.status !== 'active') {
      this.logger.log(`Onboarding not finalized: Agreement for IO ${ioRecord.io_number} status is ${agreement?.status || 'missing'}`);
      return;
    }

    // Both docs are fully executed — finalize onboarding
    this.logger.log(`Both IO and Agreement active for ${ioRecord.vendor.company_name} — finalizing onboarding`);

    const vendor = ioRecord.vendor;

    // Create TrackDrive source if not already created
    if (!vendor.td_source_id) {
      try {
        const tdResult = await this.td.createTrafficSource({
          company_name: vendor.company_name,
          first_name: vendor.contact_name.split(' ')[0],
          last_name: vendor.contact_name.split(' ').slice(1).join(' ') || undefined,
        });
        const tsData = tdResult?.traffic_source || tdResult;
        const tdSourceId = String(tsData?.id || null);
        const tdSourceName = tsData?.company_name || vendor.company_name;

        await this.prisma.vendor_profile.update({
          where: { id: vendor.id },
          data: { td_source_id: tdSourceId, td_source_name: tdSourceName },
        });

        this.logger.log(`TrackDrive source created: ${tdSourceId} for ${vendor.company_name}`);
      } catch (e: any) {
        this.logger.error(`TrackDrive source creation failed: ${e.message}`);
      }
    }

    // Notify portal to send welcome package email
    this.callPortalWebhook('/api/onboarding/webhook/io-countersigned', { io_id: ioRecord.id })
      .catch(e => this.logger.error(`Portal countersign webhook failed: ${e.message}`));

    // Send Telegram confirmation
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (botToken && chatId) {
      const msg = `<b>Vendor Fully Onboarded</b>\n\n`
        + `<b>${this.esc(vendor.company_name)}</b>\n`
        + `IO: ${ioRecord.io_number} -- Active\n`
        + `Lead Purchase Agreement -- Active\n`
        + `TrackDrive source: ${vendor.td_source_id ? 'Created' : 'Pending'}\n`
        + `Welcome email: Sent`;

      axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
      }).catch(e => this.logger.error(`Telegram finalization alert failed: ${e.message}`));
    }
  }

  private async findAgreementByShortId(shortId: string) {
    const agreements = await this.prisma.lead_purchase_agreement.findMany({
      where: { id: { startsWith: shortId } },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
    return agreements[0] || null;
  }

  private async findIOByShortId(shortId: string) {
    const ios = await this.prisma.insertion_order.findMany({
      where: { id: { startsWith: shortId } },
      include: { campaign: true, vendor: true },
    });
    return ios[0] || null;
  }

  // ==================== WEBHOOK: External app notification ====================

  async handleApplicationWebhook(applicationIds: string[]) {
    if (!applicationIds?.length) {
      throw new BadRequestException('application_ids is required');
    }

    const apps = await this.prisma.vendor_application.findMany({
      where: { id: { in: applicationIds } },
      include: { campaign: { select: { name: true, industry: true } } },
    });

    if (apps.length === 0) {
      throw new NotFoundException('No applications found for the given IDs');
    }

    const first = apps[0];
    const campaigns = apps.map(a => (a as any).campaign?.name || 'Unknown');

    // Send Discord notification
    const sent = await this.discord.sendApplicationNotification({
      companyName: first.company_name,
      contactName: first.contact_name,
      email: first.email,
      phone: first.phone,
      website: first.website || undefined,
      trafficTypes: first.traffic_types,
      estimatedVolume: first.estimated_volume || undefined,
      referredBy: first.referred_by || undefined,
      experience: first.experience || undefined,
      comments: first.comments || undefined,
      campaigns,
      applicationIds,
      dashboardUrl: this.config.get<string>('DASHBOARD_URL', 'http://localhost:3001'),
    });

    if (sent) {
      this.logger.log(`Discord notification sent for ${apps.length} application(s) from ${first.company_name}`);
    }

    return { notified: sent, application_count: apps.length };
  }

  async handleIOSignedWebhook(ioId: string) {
    if (!ioId) {
      throw new BadRequestException('io_id is required');
    }

    const io = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: {
        vendor: { select: { company_name: true, contact_name: true, email: true } },
        campaign: { select: { name: true } },
      },
    });

    if (!io) {
      throw new NotFoundException(`IO not found: ${ioId}`);
    }

    if (io.status !== 'pending_counter') {
      this.logger.warn(`IO ${ioId} status is ${io.status}, not pending_counter`);
    }

    const sent = await this.discord.sendIOSignedNotification({
      companyName: io.vendor.company_name,
      campaignName: io.campaign.name,
      ioNumber: io.io_number,
      dashboardUrl: this.config.get<string>('DASHBOARD_URL', 'http://localhost:3001'),
    });

    if (sent) {
      this.logger.log(`Discord IO signed alert sent for ${io.io_number}`);
    }
    return { notified: sent, io_number: io.io_number };
  }

  async handleAgreementSignedWebhook(agreementId: string) {
    if (!agreementId) {
      throw new BadRequestException('agreement_id is required');
    }

    const agreement = await this.prisma.lead_purchase_agreement.findUnique({
      where: { id: agreementId },
      include: {
        vendor: { select: { company_name: true, contact_name: true, email: true } },
        insertion_order: { select: { io_number: true, campaign: { select: { name: true } } } },
      },
    });

    if (!agreement) {
      throw new NotFoundException(`Agreement not found: ${agreementId}`);
    }

    // Send Discord alert
    const sent = await this.discord.sendAgreementSignedNotification({
      companyName: agreement.vendor.company_name,
      dashboardUrl: this.config.get<string>('DASHBOARD_URL', 'http://localhost:3001'),
    });

    if (sent) {
      this.logger.log(`Discord agreement signed alert sent for IO ${agreement.insertion_order.io_number}`);
    }
    return { notified: sent, io_number: agreement.insertion_order.io_number };
  }

  private async callPortalWebhook(path: string, body: Record<string, any>): Promise<void> {
    const portalOrigin = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3000');
    const url = new URL(path, portalOrigin).toString();
    try {
      await axios.post(url, body, { timeout: 10000 });
      this.logger.log(`Portal webhook called: ${path}`);
    } catch (e: any) {
      this.logger.error(`Portal webhook ${path} failed: ${e.response?.status || e.message}`);
      throw e;
    }
  }

  // ==================== AGREEMENT SIGNING ====================

  async getAgreementForSigning(signToken: string) {
    const agreement = await this.io.getAgreementBySignToken(signToken);
    if (!agreement) throw new NotFoundException('Lead Purchase Agreement not found');
    return {
      status: agreement.status,
      vendor: agreement.vendor.company_name,
      io_number: agreement.insertion_order.io_number,
      campaign: agreement.insertion_order.campaign.name,
      agreement_text: agreement.agreement_text,
      vendor_signed_at: agreement.vendor_signed_at,
      counter_signed_at: agreement.counter_signed_at,
    };
  }

  async signAgreement(signToken: string, signName: string, ip: string) {
    const agreement = await this.io.vendorSignAgreement(signToken, signName, ip);

    // Notify admin via Discord
    this.discord.sendAgreementSignedNotification({
      companyName: agreement.vendor.company_name,
      dashboardUrl: this.config.get<string>('DASHBOARD_URL', 'http://localhost:3001'),
    }).catch(e =>
      this.logger.error(`Discord agreement alert failed: ${e.message}`),
    );

    return {
      message: 'Lead Purchase Agreement signed successfully. GrovLabs will review and countersign.',
      io_number: agreement.insertion_order.io_number,
    };
  }

  async countersignAgreement(agreementId: string, signBy = 'UJ, CEO - GrovLabs Inc') {
    const agreement = await this.io.counterSignAgreement(agreementId, signBy);

    // Check if the linked IO is also countersigned — if so, finalize onboarding
    await this.checkAndFinalizeOnboarding(agreement.io_id, agreement.vendor_id);

    return {
      message: 'Lead Purchase Agreement countersigned and activated',
      io_number: agreement.insertion_order.io_number,
      vendor: agreement.vendor.company_name,
    };
  }

  async listAgreements(status?: string) {
    const where = status ? { status } : {};
    return this.prisma.lead_purchase_agreement.findMany({
      where,
      include: {
        vendor: { select: { company_name: true, email: true } },
        insertion_order: { select: { io_number: true, status: true, campaign: { select: { name: true } } } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAgreementDownloadHtml(agreementId: string): Promise<string> {
    const agreement = await this.prisma.lead_purchase_agreement.findUnique({
      where: { id: agreementId },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
    if (!agreement) throw new Error('Agreement not found');
    return this.io.generateAgreementDownloadHtml(agreement);
  }

  private async sendTelegramAgreementSignedAlert(agreement: any): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) return;

    const shortId = agreement.id.substring(0, 8);
    let msg = `<b>Lead Purchase Agreement Signed by Vendor</b>\n\n`;
    msg += `<b>${this.esc(agreement.vendor.company_name)}</b>\n`;
    msg += `Campaign: ${this.esc(agreement.insertion_order.campaign.name)}\n`;
    msg += `Linked IO: ${agreement.insertion_order.io_number}\n`;
    msg += `Signed by: ${this.esc(agreement.vendor_sign_name || 'Unknown')} (${agreement.vendor_sign_ip || 'N/A'})\n`;
    msg += `\nReady for countersignature.`;

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: msg,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Countersign Agreement', callback_data: `acs_${shortId}` },
        ]],
      },
    });
  }

  // ==================== IO DOWNLOAD & AGREEMENT ====================

  async getIODownloadHtml(ioId: string): Promise<string> {
    const ioRecord = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: {
        vendor: true,
        campaign: true,
      },
    });
    if (!ioRecord) throw new Error('IO not found');
    return this.io.generateIODownloadHtml(ioRecord);
  }

  async getLeadPurchaseAgreementHtml(
    ioId: string,
    overrides?: { vendorState?: string; entityType?: string; vendorAddress?: string },
  ): Promise<string> {
    const ioRecord = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: { vendor: true },
    });
    if (!ioRecord) throw new Error('IO not found');

    const vendor = ioRecord.vendor;
    const agreementText = this.io.buildLeadPurchaseAgreement(
      vendor.company_name,
      overrides?.vendorState || '___________',
      overrides?.entityType || 'company',
      overrides?.vendorAddress || '___________',
    );

    // Wrap in styled HTML similar to IO download page
    const vendorName = vendor.company_name;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lead Purchase Agreement - ${vendorName} | GrovLabs Inc</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', 'Times New Roman', serif; background: #f7fafc; color: #1a202c; }
    .page { max-width: 850px; margin: 0 auto; background: #fff; padding: 60px 72px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
    .header { text-align: center; border-bottom: 2px solid #2d3748; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 22px; letter-spacing: 1px; color: #2d3748; margin-bottom: 6px; }
    .header p { font-size: 13px; color: #718096; }
    .agreement-body { white-space: pre-wrap; font-size: 13px; line-height: 1.8; }
    .actions { text-align: center; margin-top: 40px; padding: 20px 0; border-top: 1px solid #e2e8f0; }
    .actions button { background: #2d3748; color: #fff; border: none; padding: 12px 32px; font-size: 14px; cursor: pointer; border-radius: 4px; margin: 0 8px; }
    .actions button:hover { background: #4a5568; }
    @media print { .actions { display: none; } body { background: #fff; } .page { box-shadow: none; padding: 40px; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>LEAD PURCHASE AGREEMENT</h1>
      <p>GrovLabs Inc — ${vendorName}</p>
    </div>
    <div class="agreement-body">${agreementText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="actions">
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}