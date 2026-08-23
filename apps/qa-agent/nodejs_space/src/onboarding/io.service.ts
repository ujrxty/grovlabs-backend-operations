import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomBytes } from 'crypto';

@Injectable()
export class IOService {
  private readonly logger = new Logger(IOService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Generate next IO number: GL-IO-2026-0001 */
  async nextIONumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counter = await this.prisma.io_counter.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', year, count: 1 },
      update: {
        count: { increment: 1 },
        // Reset counter if new year
        year,
      },
    });
    // If year rolled over, reset
    if (counter.year !== year) {
      await this.prisma.io_counter.update({
        where: { id: 'singleton' },
        data: { year, count: 1 },
      });
      return `GL-IO-${year}-0001`;
    }
    return `GL-IO-${year}-${String(counter.count).padStart(4, '0')}`;
  }

  /** Generate sign token */
  generateSignToken(): string {
    return randomBytes(16).toString('hex');
  }

  /** Build IO terms from campaign — comprehensive legal protection */
  buildTerms(campaign: any, vendorName: string, specialTerms?: string): string {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const billingDesc = 'Bi-Weekly Net 15 (all billable activity for each two-week period is payable 15 days after the close of that period; if the due date falls on a weekend or holiday, payment is due the next business day)';

    const lines: (string | null)[] = [
      `AFFILIATE INSERTION ORDER`,
      ``,
      `This Insertion Order ("IO") is entered into between GrovLabs Inc ("Company") and ${vendorName} ("Affiliate"), and is subject to the terms below. This IO is effective as of the date of last signature and governs the Affiliate's participation in the Campaign(s) described herein.`,
      ``,
      ``,
      `1. CAMPAIGN SPECIFICATIONS`,
      ``,
      `   Campaign:          ${campaign.name}`,
      `   Industry:          ${campaign.industry}`,
      `   Call Type:          ${campaign.call_type}`,
      `   Payout:            $${Number(campaign.payout).toFixed(2)} ${this.formatPayoutType(campaign.payout_type)}`,
      campaign.min_duration ? `   Min Duration:       ${campaign.min_duration} seconds` : null,
      campaign.geographic_focus ? `   Geographic Focus:   ${campaign.geographic_focus}` : null,
      campaign.requirements ? `   Requirements:       ${campaign.requirements}` : null,
      campaign.compliance_notes ? `   Caps/Notes:         ${campaign.compliance_notes}` : null,
      ``,
      `   For RTB (Real Time Bidding) campaigns: payout is variable and determined`,
      `   by real-time buyer bidding. The payout listed above is the minimum floor.`,
      `   GrovLabs retains 15% of the winning bid amount on RTB campaigns.`,
      ``,
      ``,
      `2. PAYMENT TERMS`,
      ``,
      `   Billing Cycle:  ${billingDesc}`,
      ``,
      `   (a) Affiliate must maintain current and valid payment information on file.`,
      `   (b) Company reserves the right to withhold payment pending quality review.`,
      `   (c) Disputed calls will be reviewed within 10 business days of dispute.`,
      `   (d) Company may offset amounts owed against invalid lead chargebacks.`,
      `   (e) Payments under $50 may be held and rolled into the next billing cycle.`,
      ``,
      ``,
      `3. TRAFFIC REQUIREMENTS`,
      ``,
      `   Allowed Traffic:     ${campaign.allowed_traffic || 'All compliant traffic sources'}`,
      `   Restricted Traffic:  ${campaign.restricted_traffic || 'Robocalls, Cold Transfers, Auto-dialers, Pre-recorded messages, Incentivized traffic'}`,
      ``,
      `   Affiliate represents and warrants that all traffic delivered under this IO:`,
      `   (a) Is generated through legitimate, compliant marketing channels;`,
      `   (b) Does not include robocalls, auto-dialed calls, pre-recorded messages,`,
      `       cold transfers, or any form of artificially generated traffic;`,
      `   (c) Is not incentivized (no promise of reward, gift, or payment to callers);`,
      `   (d) Does not originate from sub-affiliates unless expressly authorized in`,
      `       writing by Company;`,
      `   (e) Does not promote government assistance, programs, or grants.`,
      ``,
      ``,
      `4. COMPLIANCE`,
      ``,
      `   Affiliate agrees to comply with all applicable federal, state, and local laws`,
      `   and regulations, including but not limited to:`,
      ``,
      `   (a) Telephone Consumer Protection Act (TCPA)`,
      `   (b) Federal Communications Commission (FCC) regulations`,
      `   (c) Federal Trade Commission (FTC) Telemarketing Sales Rule (TSR)`,
      `   (d) State Do-Not-Call (DNC) regulations`,
      `   (e) CAN-SPAM Act (for any email-based lead generation)`,
      `   (f) All applicable state telemarketing and consumer protection laws`,
      ``,
      `   Affiliate shall not make any false, misleading, or deceptive claims in`,
      `   advertising, landing pages, or caller interactions. Affiliate shall not`,
      `   promise specific amounts, guaranteed services, or government benefits.`,
      ``,
      ``,
      `5. INVALID LEADS AND RETURNS`,
      ``,
      `   Company shall have the right to reject and return any lead that is Invalid.`,
      `   "Invalid" means any lead that:`,
      ``,
      `   (a) Is generated through fraudulent means, as determined solely by Company;`,
      `   (b) Fails to conform to the Campaign Specifications in this IO;`,
      `   (c) Is a test call, duplicate call, or call with fabricated information;`,
      `   (d) Contains invalid, wrong, or inoperable phone numbers;`,
      `   (e) Is from a consumer who did not initiate or request the call;`,
      `   (f) Is from a non-homeowner (for campaigns requiring homeownership);`,
      `   (g) Is from a consumer with no genuine intent to purchase services;`,
      `   (h) Appears on any Do Not Call list;`,
      `   (i) Is a Spanish-speaking-only lead (unless campaign specifies otherwise);`,
      `   (j) Does not meet the minimum call duration requirement;`,
      `   (k) Is a cold transfer (outbound call disguised as inbound);`,
      `   (l) Was generated using auto-dialers, robocalls, or pre-recorded messages.`,
      ``,
      `   Company may identify and return Invalid leads by the 10th of the month`,
      `   following the billing period. If Company has already remitted payment for`,
      `   leads later determined to be Invalid, Company may deduct the corresponding`,
      `   amounts from future payments or invoice Affiliate for reimbursement.`,
      ``,
      ``,
      `6. INDEMNIFICATION`,
      ``,
      `   Affiliate shall indemnify, defend, and hold harmless Company, its officers,`,
      `   directors, employees, agents, and affiliates from and against any and all`,
      `   claims, damages, losses, liabilities, costs, and expenses (including`,
      `   reasonable attorneys' fees) arising out of or relating to:`,
      ``,
      `   (a) Affiliate's breach of any representation, warranty, or obligation`,
      `       under this IO;`,
      `   (b) Any claims arising from Affiliate's marketing practices, advertising`,
      `       materials, or lead generation methods;`,
      `   (c) Any violation of applicable laws or regulations by Affiliate,`,
      `       including but not limited to TCPA, FCC, FTC, and state consumer`,
      `       protection laws;`,
      `   (d) Any third-party claims resulting from calls, leads, or traffic`,
      `       generated by Affiliate or Affiliate's sub-affiliates;`,
      `   (e) Any fines, penalties, or regulatory actions imposed on Company as a`,
      `       result of Affiliate's activities.`,
      ``,
      `   This indemnification obligation shall survive the termination of this IO.`,
      ``,
      ``,
      `7. QUALITY MONITORING AND ENFORCEMENT`,
      ``,
      `   (a) All calls are recorded and monitored for quality assurance using`,
      `       automated AI-powered analysis and human review.`,
      `   (b) Affiliate acknowledges and consents to call recording and analysis.`,
      `   (c) Company may pause or terminate Affiliate's traffic at any time for`,
      `       quality concerns, including but not limited to:`,
      `       - Conversion rate below 5%`,
      `       - Detection of cold transfers or fraudulent call patterns`,
      `       - Excessive duplicate calls (>30% duplication rate)`,
      `       - Three or more QA-flagged calls`,
      `       - Any violation of traffic requirements`,
      `   (d) Company's determination of call quality is final and binding.`,
      `   (e) Affiliate will be notified of quality issues and may be given an`,
      `       opportunity to cure, at Company's sole discretion.`,
      ``,
      ``,
      `8. TERM AND TERMINATION`,
      ``,
      `   (a) This IO is effective upon execution by both parties and remains in`,
      `       effect until terminated.`,
      `   (b) Either party may terminate this IO with 7 days written notice.`,
      `   (c) Company may terminate this IO immediately, without notice, for:`,
      `       - Any compliance violation`,
      `       - Fraudulent activity or suspected fraud`,
      `       - Material breach of any term`,
      `       - Repeated quality failures`,
      `   (d) Upon termination, all unpaid amounts for valid leads delivered prior`,
      `       to termination remain payable, subject to quality review.`,
      `   (e) Sections 5, 6, 7, 9, and 10 survive termination.`,
      ``,
      ``,
      `9. LIMITATION OF LIABILITY`,
      ``,
      `   In no event shall Company be liable for any indirect, incidental, special,`,
      `   consequential, or punitive damages, or any loss of profits or revenue,`,
      `   whether incurred directly or indirectly, arising from this IO. Company's`,
      `   total aggregate liability under this IO shall not exceed the total amount`,
      `   paid to Affiliate under this IO during the three (3) months preceding`,
      `   the claim.`,
      ``,
      ``,
      `10. CONFIDENTIALITY`,
      ``,
      `   Affiliate shall keep confidential all campaign specifications, payout`,
      `   rates, buyer information, routing details, and any other proprietary`,
      `   information disclosed under this IO. Affiliate shall not disclose such`,
      `   information to any third party without Company's prior written consent.`,
      `   This obligation survives termination for a period of two (2) years.`,
      ``,
      ``,
      `11. INDEPENDENT CONTRACTOR`,
      ``,
      `   Affiliate is an independent contractor. Nothing in this IO creates a`,
      `   partnership, joint venture, agency, or employment relationship. Affiliate`,
      `   is solely responsible for its own taxes, insurance, and business expenses.`,
      ``,
      ``,
      `12. MISCELLANEOUS`,
      ``,
      `   (a) This IO constitutes the entire agreement between the parties regarding`,
      `       the subject matter herein and supersedes all prior agreements.`,
      `   (b) This IO may be amended only in writing signed by both parties.`,
      `   (c) This IO shall be governed by the laws of the State of California.`,
      `   (d) Any disputes shall be resolved by binding arbitration in Los Angeles County, CA.`,
      `   (e) If any provision is held invalid, the remaining provisions continue`,
      `       in full force and effect.`,
      `   (f) This IO may be executed in counterparts.`,
    ];

    if (campaign.terms_template) {
      lines.push('', '', '13. ADDITIONAL CAMPAIGN TERMS', '', campaign.terms_template);
    }

    if (specialTerms) {
      lines.push('', '', 'SPECIAL TERMS', '', specialTerms);
    }

    return lines.filter(l => l !== null).join('\n');
  }

  /** Build IO terms for multiple campaigns — one IO covering all */
  buildMultiCampaignTerms(campaigns: any[], vendorName: string, specialTerms?: string): string {
    const billingDesc = 'Bi-Weekly Net 15 (all billable activity for each two-week period is payable 15 days after the close of that period; if the due date falls on a weekend or holiday, payment is due the next business day)';

    // Build campaign specs table
    const campaignSpecs: string[] = [];
    campaigns.forEach((c, i) => {
      if (i > 0) campaignSpecs.push('');
      campaignSpecs.push(`   Campaign ${i + 1}: ${c.name}`);
      campaignSpecs.push(`   Industry:          ${c.industry}`);
      campaignSpecs.push(`   Call Type:          ${c.call_type}`);
      campaignSpecs.push(`   Payout:            $${Number(c.payout).toFixed(2)} ${this.formatPayoutType(c.payout_type)}`);
      if (c.min_duration) campaignSpecs.push(`   Min Duration:       ${c.min_duration} seconds`);
      if (c.geographic_focus) campaignSpecs.push(`   Geographic Focus:   ${c.geographic_focus}`);
      if (c.requirements) campaignSpecs.push(`   Requirements:       ${c.requirements}`);
      if (c.compliance_notes) campaignSpecs.push(`   Caps/Notes:         ${c.compliance_notes}`);
    });

    // Merge traffic restrictions from all campaigns
    const allRestricted = campaigns
      .map(c => c.restricted_traffic || 'Robocalls, Cold Transfers, Auto-dialers, Pre-recorded messages, Incentivized traffic')
      .join('; ');
    const allAllowed = campaigns
      .map(c => c.allowed_traffic || 'All compliant traffic sources')
      .join('; ');

    const lines: (string | null)[] = [
      `AFFILIATE INSERTION ORDER`,
      ``,
      `This Insertion Order ("IO") is entered into between GrovLabs Inc ("Company") and ${vendorName} ("Affiliate"), and is subject to the terms below. This IO is effective as of the date of last signature and governs the Affiliate's participation in the Campaign(s) described herein.`,
      ``,
      `This IO covers ${campaigns.length} campaign(s).`,
      ``,
      ``,
      `1. CAMPAIGN SPECIFICATIONS`,
      ``,
      ...campaignSpecs,
      ``,
      `   For RTB (Real Time Bidding) campaigns: payout is variable and determined`,
      `   by real-time buyer bidding. The payout listed above is the minimum floor.`,
      `   GrovLabs retains 15% of the winning bid amount on RTB campaigns.`,
      ``,
      ``,
      `2. PAYMENT TERMS`,
      ``,
      `   Billing Cycle:  ${billingDesc}`,
      ``,
      `   (a) Affiliate must maintain current and valid payment information on file.`,
      `   (b) Company reserves the right to withhold payment pending quality review.`,
      `   (c) Disputed calls will be reviewed within 10 business days of dispute.`,
      `   (d) Company may offset amounts owed against invalid lead chargebacks.`,
      `   (e) Payments under $50 may be held and rolled into the next billing cycle.`,
      ``,
      ``,
      `3. TRAFFIC REQUIREMENTS`,
      ``,
      `   Allowed Traffic:     ${allAllowed}`,
      `   Restricted Traffic:  ${allRestricted}`,
      ``,
      `   Affiliate represents and warrants that all traffic delivered under this IO:`,
      `   (a) Is generated through legitimate, compliant marketing channels;`,
      `   (b) Does not include robocalls, auto-dialed calls, pre-recorded messages,`,
      `       cold transfers, or any form of artificially generated traffic;`,
      `   (c) Is not incentivized (no promise of reward, gift, or payment to callers);`,
      `   (d) Does not originate from sub-affiliates unless expressly authorized in`,
      `       writing by Company;`,
      `   (e) Does not promote government assistance, programs, or grants.`,
      ``,
      ``,
      `4. COMPLIANCE`,
      ``,
      `   Affiliate agrees to comply with all applicable federal, state, and local laws`,
      `   and regulations, including but not limited to:`,
      ``,
      `   (a) Telephone Consumer Protection Act (TCPA)`,
      `   (b) Federal Communications Commission (FCC) regulations`,
      `   (c) Federal Trade Commission (FTC) Telemarketing Sales Rule (TSR)`,
      `   (d) State Do-Not-Call (DNC) regulations`,
      `   (e) CAN-SPAM Act (for any email-based lead generation)`,
      `   (f) All applicable state telemarketing and consumer protection laws`,
      ``,
      `   Affiliate shall not make any false, misleading, or deceptive claims in`,
      `   advertising, landing pages, or caller interactions. Affiliate shall not`,
      `   promise specific amounts, guaranteed services, or government benefits.`,
      ``,
      ``,
      `5. INVALID LEADS AND RETURNS`,
      ``,
      `   Company shall have the right to reject and return any lead that is Invalid.`,
      `   "Invalid" means any lead that:`,
      ``,
      `   (a) Is generated through fraudulent means, as determined solely by Company;`,
      `   (b) Fails to conform to the Campaign Specifications in this IO;`,
      `   (c) Is a test call, duplicate call, or call with fabricated information;`,
      `   (d) Contains invalid, wrong, or inoperable phone numbers;`,
      `   (e) Is from a consumer who did not initiate or request the call;`,
      `   (f) Is from a non-homeowner (for campaigns requiring homeownership);`,
      `   (g) Is from a consumer with no genuine intent to purchase services;`,
      `   (h) Appears on any Do Not Call list;`,
      `   (i) Is a Spanish-speaking-only lead (unless campaign specifies otherwise);`,
      `   (j) Does not meet the minimum call duration requirement;`,
      `   (k) Is a cold transfer (outbound call disguised as inbound);`,
      `   (l) Was generated using auto-dialers, robocalls, or pre-recorded messages.`,
      ``,
      `   Company may identify and return Invalid leads by the 10th of the month`,
      `   following the billing period. If Company has already remitted payment for`,
      `   leads later determined to be Invalid, Company may deduct the corresponding`,
      `   amounts from future payments or invoice Affiliate for reimbursement.`,
      ``,
      ``,
      `6. INDEMNIFICATION`,
      ``,
      `   Affiliate shall indemnify, defend, and hold harmless Company, its officers,`,
      `   directors, employees, agents, and affiliates from and against any and all`,
      `   claims, damages, losses, liabilities, costs, and expenses (including`,
      `   reasonable attorneys' fees) arising out of or relating to:`,
      ``,
      `   (a) Affiliate's breach of any representation, warranty, or obligation`,
      `       under this IO;`,
      `   (b) Any claims arising from Affiliate's marketing practices, advertising`,
      `       materials, or lead generation methods;`,
      `   (c) Any violation of applicable laws or regulations by Affiliate,`,
      `       including but not limited to TCPA, FCC, FTC, and state consumer`,
      `       protection laws;`,
      `   (d) Any third-party claims resulting from calls, leads, or traffic`,
      `       generated by Affiliate or Affiliate's sub-affiliates;`,
      `   (e) Any fines, penalties, or regulatory actions imposed on Company as a`,
      `       result of Affiliate's activities.`,
      ``,
      `   This indemnification obligation shall survive the termination of this IO.`,
      ``,
      ``,
      `7. QUALITY MONITORING AND ENFORCEMENT`,
      ``,
      `   (a) All calls are recorded and monitored for quality assurance using`,
      `       automated AI-powered analysis and human review.`,
      `   (b) Affiliate acknowledges and consents to call recording and analysis.`,
      `   (c) Company may pause or terminate Affiliate's traffic at any time for`,
      `       quality concerns, including but not limited to:`,
      `       - Conversion rate below 5%`,
      `       - Detection of cold transfers or fraudulent call patterns`,
      `       - Excessive duplicate calls (>30% duplication rate)`,
      `       - Three or more QA-flagged calls`,
      `       - Any violation of traffic requirements`,
      `   (d) Company's determination of call quality is final and binding.`,
      `   (e) Affiliate will be notified of quality issues and may be given an`,
      `       opportunity to cure, at Company's sole discretion.`,
      ``,
      ``,
      `8. TERM AND TERMINATION`,
      ``,
      `   (a) This IO is effective upon execution by both parties and remains in`,
      `       effect until terminated.`,
      `   (b) Either party may terminate this IO with 7 days written notice.`,
      `   (c) Company may terminate this IO immediately, without notice, for:`,
      `       - Any compliance violation`,
      `       - Fraudulent activity or suspected fraud`,
      `       - Material breach of any term`,
      `       - Repeated quality failures`,
      `   (d) Upon termination, all unpaid amounts for valid leads delivered prior`,
      `       to termination remain payable, subject to quality review.`,
      `   (e) Sections 5, 6, 7, 9, and 10 survive termination.`,
      ``,
      ``,
      `9. LIMITATION OF LIABILITY`,
      ``,
      `   In no event shall Company be liable for any indirect, incidental, special,`,
      `   consequential, or punitive damages, or any loss of profits or revenue,`,
      `   whether incurred directly or indirectly, arising from this IO. Company's`,
      `   total aggregate liability under this IO shall not exceed the total amount`,
      `   paid to Affiliate under this IO during the three (3) months preceding`,
      `   the claim.`,
      ``,
      ``,
      `10. CONFIDENTIALITY`,
      ``,
      `   Affiliate shall keep confidential all campaign specifications, payout`,
      `   rates, buyer information, routing details, and any other proprietary`,
      `   information disclosed under this IO. Affiliate shall not disclose such`,
      `   information to any third party without Company's prior written consent.`,
      `   This obligation survives termination for a period of two (2) years.`,
      ``,
      ``,
      `11. INDEPENDENT CONTRACTOR`,
      ``,
      `   Affiliate is an independent contractor. Nothing in this IO creates a`,
      `   partnership, joint venture, agency, or employment relationship. Affiliate`,
      `   is solely responsible for its own taxes, insurance, and business expenses.`,
      ``,
      ``,
      `12. MISCELLANEOUS`,
      ``,
      `   (a) This IO constitutes the entire agreement between the parties regarding`,
      `       the subject matter herein and supersedes all prior agreements.`,
      `   (b) This IO may be amended only in writing signed by both parties.`,
      `   (c) This IO shall be governed by the laws of the State of California.`,
      `   (d) Any disputes shall be resolved by binding arbitration in Los Angeles County, CA.`,
      `   (e) If any provision is held invalid, the remaining provisions continue`,
      `       in full force and effect.`,
      `   (f) This IO may be executed in counterparts.`,
    ];

    if (specialTerms) {
      lines.push('', '', 'SPECIAL TERMS', '', specialTerms);
    }

    return lines.filter(l => l !== null).join('\n');
  }

  private formatPayoutType(type: string): string {
    const map: Record<string, string> = {
      per_conversion: 'per conversion',
      per_call: 'per call',
      per_qualified_call: 'per qualified call',
    };
    return map[type] || type;
  }

  /** Create IO for approved vendor + single campaign */
  async createIO(
    vendorId: string,
    campaignId: string,
    specialTerms?: string,
  ): Promise<any> {
    return this.createMultiCampaignIO(vendorId, [campaignId], specialTerms);
  }

  /** Create ONE consolidated IO for approved vendor + multiple campaigns */
  async createMultiCampaignIO(
    vendorId: string,
    campaignIds: string[],
    specialTerms?: string,
  ): Promise<any> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      orderBy: { name: 'asc' },
    });
    if (campaigns.length === 0) throw new Error('No campaigns found');

    const vendor = await this.prisma.vendor_profile.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new Error('Vendor not found');

    const ioNumber = await this.nextIONumber();
    const signToken = this.generateSignToken();

    // Use multi-campaign terms if >1 campaign, else single campaign terms
    const terms = campaigns.length > 1
      ? this.buildMultiCampaignTerms(campaigns, vendor.company_name, specialTerms)
      : this.buildTerms(campaigns[0], vendor.company_name, specialTerms);

    // Primary campaign is first; store all campaign IDs in campaign_ids JSON field
    const primaryCampaign = campaigns[0];

    const io = await this.prisma.insertion_order.create({
      data: {
        io_number: ioNumber,
        vendor_id: vendorId,
        campaign_id: primaryCampaign.id,
        campaign_ids: JSON.stringify(campaignIds),
        payout: primaryCampaign.payout,
        payout_type: primaryCampaign.payout_type,
        billing_cycle: primaryCampaign.billing_cycle,
        min_duration: primaryCampaign.min_duration,
        terms,
        special_terms: specialTerms || null,
        sign_token: signToken,
        status: 'pending_vendor',
      },
      include: { campaign: true, vendor: true },
    });

    const campaignNames = campaigns.map(c => c.name).join(', ');
    this.logger.log(`IO created: ${ioNumber} for ${vendor.company_name} / ${campaignNames}`);
    return io;
  }

  /**
   * Add one or more campaigns to an EXISTING, still-unsigned (pending_vendor) IO.
   * Rebuilds the consolidated terms to include all campaigns and updates campaign_ids.
   * Used to bundle individual application approvals into ONE IO. Keeps the same
   * sign_token so the vendor's existing sign link stays valid.
   */
  async addCampaignsToExistingIO(ioId: string, newCampaignIds: string[], specialTerms?: string): Promise<any> {
    const io = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: { vendor: true },
    });
    if (!io) throw new Error('IO not found');
    if (io.status !== 'pending_vendor') {
      throw new Error(`Cannot add campaigns to an IO that is ${io.status}`);
    }

    // Merge existing + new campaign ids (dedupe)
    let existingIds: string[] = [];
    if (io.campaign_ids) {
      try {
        const parsed = JSON.parse(io.campaign_ids);
        if (Array.isArray(parsed)) existingIds = parsed;
      } catch {
        /* ignore */
      }
    }
    if (existingIds.length === 0 && io.campaign_id) existingIds = [io.campaign_id];
    const mergedIds = Array.from(new Set([...existingIds, ...newCampaignIds]));

    // Load all campaigns, ordered consistently with createMultiCampaignIO (by name asc)
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: mergedIds } },
      orderBy: { name: 'asc' },
    });
    if (campaigns.length === 0) throw new Error('No campaigns found');

    const primaryCampaign = campaigns[0];
    const mergedInOrder = campaigns.map(c => c.id);
    const effectiveSpecial = specialTerms ?? io.special_terms ?? undefined;
    const terms = campaigns.length > 1
      ? this.buildMultiCampaignTerms(campaigns, io.vendor.company_name, effectiveSpecial)
      : this.buildTerms(campaigns[0], io.vendor.company_name, effectiveSpecial);

    const updated = await this.prisma.insertion_order.update({
      where: { id: io.id },
      data: {
        campaign_id: primaryCampaign.id,
        campaign_ids: JSON.stringify(mergedInOrder),
        payout: primaryCampaign.payout,
        payout_type: primaryCampaign.payout_type,
        billing_cycle: primaryCampaign.billing_cycle,
        min_duration: primaryCampaign.min_duration,
        terms,
        special_terms: effectiveSpecial || null,
      },
      include: { campaign: true, vendor: true },
    });

    const names = campaigns.map(c => c.name).join(', ');
    this.logger.log(`IO ${updated.io_number} updated to bundle campaigns: ${names}`);
    return updated;
  }

  /**
   * Void/cancel a pending IO. Rotates its sign_token so the old vendor sign link
   * can no longer be used, and voids any attached PENDING Lead Purchase Agreement
   * (an already-active/countersigned LPA — the master agreement — is preserved).
   */
  async voidIO(ioId: string, reason?: string): Promise<any> {
    const io = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: { lead_purchase_agreements: true, vendor: true, campaign: true },
    });
    if (!io) throw new Error('IO not found');
    if (io.status !== 'pending_vendor' && io.status !== 'pending_counter') {
      throw new Error(`Only pending IOs can be voided (current status: ${io.status})`);
    }

    // Rotate the sign token to invalidate the old sign link
    const deadToken = `voided-${this.generateSignToken()}`;
    await this.prisma.insertion_order.update({
      where: { id: io.id },
      data: { status: 'voided', sign_token: deadToken },
    });

    // Void any attached PENDING LPAs (preserve active/countersigned master LPA)
    const voidedAgreements: string[] = [];
    for (const lpa of io.lead_purchase_agreements) {
      if (lpa.status === 'pending_vendor' || lpa.status === 'pending_counter') {
        await this.prisma.lead_purchase_agreement.update({
          where: { id: lpa.id },
          data: { status: 'voided', sign_token: `voided-${this.generateSignToken()}` },
        });
        voidedAgreements.push(lpa.id);
      }
    }

    this.logger.log(
      `Voided IO ${io.io_number} (${io.vendor.company_name})${reason ? ` — ${reason}` : ''}; voided ${voidedAgreements.length} pending LPA(s)`,
    );

    return {
      io_id: io.id,
      io_number: io.io_number,
      previous_status: io.status,
      voided_agreements: voidedAgreements.length,
    };
  }

  /** Vendor signs IO */
  async vendorSign(signToken: string, signName: string, signIp: string): Promise<any> {
    const io = await this.prisma.insertion_order.findUnique({
      where: { sign_token: signToken },
      include: { campaign: true, vendor: true },
    });
    if (!io) throw new Error('IO not found');
    if (io.status !== 'pending_vendor') throw new Error(`IO is not pending vendor signature (status: ${io.status})`);

    const updated = await this.prisma.insertion_order.update({
      where: { id: io.id },
      data: {
        vendor_signed_at: new Date(),
        vendor_sign_name: signName,
        vendor_sign_ip: signIp,
        status: 'pending_counter',
      },
      include: { campaign: true, vendor: true },
    });

    this.logger.log(`IO ${io.io_number} signed by vendor: ${signName}`);
    return updated;
  }

  /** Admin countersigns IO */
  async counterSign(ioId: string, signBy: string): Promise<any> {
    const io = await this.prisma.insertion_order.findUnique({
      where: { id: ioId },
      include: { campaign: true, vendor: true },
    });
    if (!io) throw new Error('IO not found');
    if (io.status !== 'pending_counter') throw new Error(`IO is not pending countersignature (status: ${io.status})`);

    const updated = await this.prisma.insertion_order.update({
      where: { id: io.id },
      data: {
        counter_signed_at: new Date(),
        counter_sign_by: signBy,
        status: 'active',
        effective_date: new Date(),
      },
      include: { campaign: true, vendor: true },
    });

    this.logger.log(`IO ${io.io_number} countersigned by: ${signBy}`);
    return updated;
  }

  /** Get IO by sign token (public) */
  async getBySignToken(signToken: string): Promise<any> {
    return this.prisma.insertion_order.findUnique({
      where: { sign_token: signToken },
      include: { campaign: true, vendor: true },
    });
  }

  /** Build the Lead Purchase Agreement text for a vendor */
  buildLeadPurchaseAgreement(
    vendorName: string,
    vendorState: string,
    vendorEntityType: string,
    vendorAddress: string,
    vendorCountry?: string,
  ): string {
    // Build the entity description clause. For international vendors we state the
    // jurisdiction of organization (state/province + country) explicitly. For US
    // vendors (no country, or country is USA) we keep the familiar "[State] [entity]"
    // phrasing to avoid redundancy.
    const country = (vendorCountry || '').trim();
    const isUS =
      country === '' ||
      /^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i.test(country);
    let entityClause: string;
    if (isUS) {
      // Domestic phrasing (unchanged): "a [State] [entity] located at [address]"
      entityClause = `a ${vendorState} ${vendorEntityType} located at ${vendorAddress}`;
    } else {
      // International phrasing: state jurisdiction of organization + country
      const stateHasValue = vendorState && vendorState.trim() !== '' && !/^_+$/.test(vendorState.trim());
      const jurisdiction = stateHasValue ? `${vendorState}, ${country}` : country;
      entityClause = `a ${vendorEntityType} organized under the laws of ${jurisdiction}, located at ${vendorAddress}`;
    }
    return `LEAD PURCHASE AGREEMENT

This Lead Purchase Agreement ("Agreement") is entered into by and between GrovLabs Inc, a Missouri corporation located at 8301 State Line Rd. Ste 220 #3921, Kansas City, MO 64114 ("GrovLabs" or "Buyer") and ${vendorName}, ${entityClause} ("Seller" or "Publisher"). This Agreement will be effective as of the date of the last recorded signature below (the "Effective Date"). GrovLabs and Seller may each be individually referred to herein as a "Party" and collectively as the "Parties."

WHEREAS, Seller generates Leads through, inter alia, its websites and platforms and posts the Leads to third party buyers;

WHEREAS GrovLabs desires to utilize Seller's lead generation services and purchase Leads from Seller.

NOW THEREFORE, in consideration of the mutual promises and conditions set forth in this Agreement, the Parties agree to be bound by the following terms regarding the generation, posting, and purchase of Leads.


DEFINITIONS

"GrovLabs" refers to GrovLabs Inc, as indicated above.

"Agreement" means this Lead Purchase Agreement entered into and signed by the Parties.

"Seller" refers to the other company indicated above. Any reference to Seller herein shall also include Seller's internal, exclusive, and/or third-party marketing agents, partners, affiliates, and/or publishers generating Leads by and through Seller in connection with the Lead Generation Services.

"Confidential Information" means all data and information, of a confidential nature or otherwise, disclosed during the term of this Agreement by one Party ("Disclosing Party") to the other Party ("Receiving Party"), as well as information that the Receiving Party knows or should know that the Disclosing Party regards as confidential including, but not limited to: (i) a Party's business plans, strategies, know how, marketing plans, suppliers, sources of materials, finances, business relationships, processes, methodologies, customer and vendor lists, personally identifiable customer or Lead information, pricing, technology, employees, trade secrets and other non-public or proprietary information whether written, oral, recorded on tapes or in any other media or format; (ii) the material terms of this Agreement, and any Insertion Orders; and (iii) any information marked or designated by the Disclosing Party as confidential, or that which would be reasonable to treat as confidential due to the nature and circumstances of disclosure. Confidential Information shall not include any information that the Receiving Party can verify with substantial proof: (1) is generally available to or known to the public through no wrongful act of the Receiving Party; (2) already in the possession of the Receiving Party; (3) was independently developed by the Receiving Party without the use of or reference to Confidential Information; or (4) was disclosed to the Receiving Party by a third party legally in possession of such Confidential Information and under no obligation of confidentiality to the Disclosing Party.

"Cost Per Lead" is the cost measured per Lead that is provided by Seller to GrovLabs and will be set forth on the applicable Insertion Order.

"Effective Date" refers to the date of the last recorded signature below and the date this Agreement commences.

"Insertion Order" means any insertion order that is agreed to and signed by the Parties, outlining the specific terms of the Lead Generation Services. Insertion Orders shall be deemed incorporated into this Agreement by reference herein.

"Lead" means a file containing certain required information on a prospective customer which has been generated by Seller through its Websites, partners, platforms and resources containing all of the necessary data fields required in the applicable Insertion Order.

"Lead Generation Services" means Seller's generation of legally compliant Leads through the use of its websites, partners, platforms and resources and posting of Leads pursuant to this Agreement.

"Websites" in the context of Seller's Lead Generation Services, means websites or webpages hosted by Seller and/or partners and utilized to generate Leads hereunder.


TERMS

1. LEAD GENERATION SERVICES.

Seller will provide its Lead Generation Services to GrovLabs, and GrovLabs will pay Seller for its Lead Generation Services in accordance with this Agreement and any applicable Insertion Order. The specific information required for each Lead, the quantity of Leads, and any characteristics or uniqueness requirements for the Leads shall be set forth in an Insertion Order. Seller will generate Leads through its Websites and will post the Leads to GrovLabs's database, or to GrovLabs via ping/post, at the frequency specified in the applicable Insertion Order. Upon GrovLabs's acceptance of posted Leads, GrovLabs shall have sole and exclusive ownership of the Leads and any associated data, and is permitted to sell the Leads to third party buyers within its lead buyer network within its sole discretion. Seller may not use, rent, license, sell, transfer, assign, or attempt to monetize any Leads posted and accepted by GrovLabs hereunder for Seller's own purposes, including to other buyers and third parties.


2. TRACKING AND PAYMENT.

The applicable Insertion Order will specify the applicable Cost Per Lead amount. Upon Seller's posting of a Lead to GrovLabs that meets all requirements listed in an applicable Insertion Order, GrovLabs is deemed to be in receipt of the Lead and payment is due in accordance with this Agreement and the applicable Insertion Order. Seller agrees not to modify, disable, or re-direct links or in any way impede or impair GrovLabs's ability to track the Leads.


3. TERM AND TERMINATION.

This Agreement will begin on the Effective Date and continue until terminated. This Agreement and any Insertion Order may be terminated by either Party at any time and for any reason by providing written notice of its intent to terminate at least three (3) business days prior to the termination. GrovLabs may also immediately terminate this Agreement, if in its sole discretion, it believes that Seller has breached this Agreement. Further, in the instance of termination by either Party, Seller shall refund GrovLabs for any pre-payments made and not used prior to termination.


4. GROVLABS REPRESENTATIONS AND WARRANTIES.

GrovLabs hereby represents and warrants that: (a) it is duly organized and validly existing under the laws of the jurisdiction in which it is organized; (b) it has full power and authority to enter into this Agreement and to carry out its obligations hereunder; and (c) it will perform all of its activities, obligations and responsibilities contemplated under this Agreement, including the collection, use, and storage of the Leads provided by Seller in compliance with all Applicable Laws and Regulations as defined herein-below, in compliance with all U.S. laws and regulations, including but not limited to, the California Consumer Privacy Act, Cal. Civ. Code 1798.100 et seq., Cal. Civ. Code 1798.100 et seq ("CCPA"), together with any applicable state privacy regulations, the Telephone Consumer Protection Act, 47 U.S.C. 227 et seq. ("TCPA") and the FCC's implementing rules and regulations, including 47 C.F.R. 64.200, the Telemarketing Sales Rule ("TSR"), Do Not Call ("DNC") rules, the Federal Trade Commission Act ("FTC Act") and all FTC rules, regulations, and guidelines, the Telemarketing and Consumer Fraud and Abuse Prevention Act, 15 U.S.C. 6101 et seq., and the CAN-SPAM Act of 2003, as amended, (collectively, "Applicable Laws and Regulations").

GrovLabs will indemnify Seller from and against any and all liabilities, claims, actions, suits, proceedings, judgments, fines, damages, costs, fees, losses, and expenses (including reasonable attorneys' fees, court costs and/or settlement costs) arising from or related to any claim that GrovLabs violates Applicable Laws and Regulations or breaches its representations as contained herein, to the extent not first caused by the acts and/or omissions of Seller in providing such leads in compliance with all Applicable Rules and Regulations. GrovLabs will promptly notify Seller of any claim, complaint, inquiry, or investigation that may give rise to indemnification. GrovLabs will promptly assume such defense with counsel reasonably acceptable to Seller upon written notice of such indemnifiable claim. Seller reserves the right to participate in the defense at its sole expense.


5. SELLER/PUBLISHER REPRESENTATIONS AND WARRANTIES.

Seller hereby represents and warrants that: (a) it is duly organized and validly existing under the laws of the jurisdiction in which it is organized; (b) it has full power and authority to enter into this Agreement and to carry out its obligations hereunder; (c) it has the authority to provide the Leads to GrovLabs; (d) the Websites and Lead Generation Services comply with all Applicable Laws and Regulations; and (e) all Leads transferred hereunder to GrovLabs consist of individuals that have provided their "prior express written consent" under the TCPA and the FCC's implementing rules, regulations, and orders, including 47 C.F.R. 64.1200(f)(8), to receive commercial telephone calls (including prerecorded calls, artificial voice calls, autodialed calls and SMS text messages) from GrovLabs and/or its third party lead buyers specified in the applicable Insertion Order and their affirmative consent as defined in the CAN-SPAM Act of 2003, as amended, to receive commercial email from GrovLabs and/or its third party lead buyers. Seller shall maintain consent records in the form of capture of screenshots for the Websites and all Lead Generation Services from where such consent was collected, including the consent verbiage, telephone number, IP address for the consenting individual, date and time stamp of the consent, and any other identifying information for all Leads transferred hereunder for a minimum of five (5) years following collection of same. Seller shall also ensure compliance with the FCC "one to one consent" rules whereby Seller is only allowed to utilize the Leads from customers who have agreed in writing to the single business being solicited, unless the customer has explicitly consented to be contacted regarding additional businesses, and Seller shall provide GrovLabs written proof of same. Further, Seller/Publisher further represents and warrants that it shall use and retain verification proof of "prior express written consent" through the use of a third-party lead verification service through Trusted Form and Jornaya, and within one (1) business day of GrovLabs's request, Seller shall forward any requested consent records.

Seller further represents and warrants that the Websites and Lead Generation Services shall meet the following requirements: a) be written in English; b) be targeted only to United States residents; c) have a top-level domain name; d) not have any false, misleading, or deceptive content; e) not use inappropriate content including, without limitation, content that promotes or contains language referring to the use of alcohol, tobacco or illegal substances, nudity, sexually explicit material, pornography, profanity, adult-oriented content, expletives or inappropriate language; illegal or unethical activity, deceptive acts, racism, hate, material that promotes violence, "spam," mail fraud, gambling, pyramid schemes, investment opportunities or illegal advice; libelous, defamatory, infringing, false or misleading content, or other content that is contrary to public policy or that may expose GrovLabs to negative publicity; piracy (of software, videos, audio/music, books, video games, etc.), hacking/cracking/phreaking, emulators/ROMs, or distribution of copyrighted materials; content that violates the rights of others, such as intellectual property or privacy rights; or content that is otherwise offensive or inappropriate in GrovLabs's sole discretion; f) not utilize incentivized marketing such as through sweepstakes entries, cash, rewards, points, prizes, discounts, contests, etc. to generate the Leads; g) be free of viruses, Trojan horses, trap doors, worms, malware, spyware, etc. that may damage, interfere with, intercept personal information or be used to inflate the number of Leads; h) be fully functional and not under construction; and i) not spawn process pop-ups, exit pop-ups, or pop-unders.

Seller will fully indemnify and hold GrovLabs and its owners, parents, affiliates and/or subsidiaries, and each of their respective owners, officers, directors, partners, members, managers, employees, agents, attorneys, representatives and/or assigns (collectively, the "GrovLabs Entities") harmless from and against any and all liabilities, claims, actions, suits, proceedings, judgments, fines, damages, costs, fees, losses, and expenses (including reasonable attorneys' fees, court costs and/or settlement costs) arising from or related to any claim that Seller's Leads or Lead Generation Services violate Applicable Laws and Regulations, or the right of a third party, and/or for any breach of the terms, covenants and representations contained herein. GrovLabs will promptly notify Seller of any claim, complaint, inquiry, or investigation that may give rise to indemnification. Seller will promptly assume such defense with counsel reasonably acceptable to GrovLabs upon written notice of such indemnifiable claim. GrovLabs reserves the right to participate in the defense at its sole expense. Seller agrees that it will not settle any indemnifiable claim without GrovLabs's prior written approval.


6. MUTUAL CONFIDENTIALITY.

The Parties acknowledge that in the course of dealing with each other, that they will be exposed to Confidential Information, as defined above, of the other Party, and that maintaining the confidentiality of that Confidential Information, both during and after the termination of this Agreement, is a critical part of their relationship. The Parties acknowledge that any use of Confidential Information, except to promote the best interests of the other Party, or the unauthorized disclosure of Confidential Information to third parties, would cause serious harm and would be a breach of this Agreement. The Receiving Party agrees to hold all Confidential Information in trust and confidence and, except as may be authorized by the Disclosing Party in writing or as required by Applicable Laws and Regulations to be disclosed, shall not use such Confidential Information for any purpose other than as expressly set forth in this Agreement or disclose any Confidential Information to any person, company or entity, except to those of its employees and professional advisers: (a) who need to know such information in order for the Receiving Party to perform its obligations hereunder; and (b) who have entered into a confidentiality agreement with the Receiving Party with terms at least as restrictive as those set forth herein. To the extent permitted by law, a Receiving Party agrees to give the Disclosing Party prior written notice before releasing any Confidential Information in response to any requesting government or law enforcement agency, subpoena, or other legal process. The Parties acknowledge and agree that any breach of this confidentiality provision would cause irreparable harm to the other and agree that the non-breaching party may seek an immediate injunction against any actual or threatened breach of this provision without the necessity of posting a bond. Upon termination of this Agreement for any reason, the Parties agree to immediately return or destroy all Confidential Information of the other Party that is in their possession. If requested, a Party will certify in a signed writing that all such Confidential Information has been returned or destroyed within thirty (30) days of the request. This Agreement to maintain confidentiality will survive the termination of this Agreement for a period of five (5) years, or for as long as the Confidential Information in question remains a trade secret under California law, whichever period is longer.


7. RELATIONSHIP.

The Parties are independent contractors. Nothing herein shall be construed to create a partnership, joint venture, or agency between the Parties. Neither Party has the authority to bind the other, or incur any obligation on its behalf.


8. NOTICES.

All notices, requests, consents and other communications required or permitted under this Agreement shall be in writing (including electronic transmission) and shall be (as elected by the Party giving such notice) hand delivered by messenger or courier service, electronically transmitted (such as by email, scanned PDF or e-fax), via facsimile or mailed (airmail if international) by registered or certified mail (postage prepaid), return receipt requested, addressed to the addresses below each Party's signature, or to such other address as either Party may designate by notice complying with the terms of this Section. Each such notice shall be deemed delivered (a) on the date delivered if by personal delivery; (b) if delivered electronically or by facsimile; or (c) on the date upon which the return receipt is signed or delivery is refused or the notice is designated by the postal authorities as not deliverable, as the case may be, if mailed.


9. ENTIRE AGREEMENT AND AMENDMENTS.

This writing is intended by the Parties as a final expression of their agreement and is intended also as a complete and exclusive statement of the terms of their agreement. No course of prior dealings between the Parties and no usage of the trade will be relevant to supplement or explain any term used in this Agreement. No amendment or extension of this Agreement will be binding unless in writing and signed by both Parties. Notwithstanding the above, this Agreement may be supplemented by an Insertion Order signed by both Parties. In the event a valid Insertion Order is executed in connection with this Agreement, to the extent any of the terms and conditions contained in the Insertion Order contradict the terms and conditions contained in this Agreement, the terms and conditions contained in the Insertion Order shall control the relationship between the Parties (along with all non-contradicting provisions contained in this Agreement).


10. WAIVER.

Failure to invoke any right, condition, or covenant in this Agreement by either Party will not be deemed to imply or constitute a waiver of any rights, condition, or covenant and neither Party may rely on such failure. No claim or right arising out of the breach of this Agreement can be discharged in whole or in part by a waiver or renunciation of such claim or right unless the waiver or renunciation is in writing signed by the aggrieved Party.


11. ASSIGNMENT AND BINDING EFFECT.

A Party may not assign its rights and obligations hereunder without the prior written consent of the other Party. Each Party represents that it will not take any action such as liquidation, dissolution, or merger to avoid its obligations hereunder. This Agreement will inure to the benefit of and be binding upon the Parties and to their respective successors, permitted assigns, heirs, executors, legal representatives and administrators.


12. GOVERNING LAW AND DISPUTE RESOLUTION.

This Agreement shall be treated as though it were executed and performed in Arizona and shall be governed by and construed in accordance with the laws of the State of California without regard to conflict of law principles. Any dispute arising out of or relating to this Agreement shall be resolved through binding arbitration conducted via Zoom originating from Los Angeles County, California under the auspices of the current Commercial Arbitration Rules of the American Arbitration Association. In addition to all other rights and remedies a Party may have, the prevailing Party in any arbitration or legal action shall be entitled to an award of its reasonable attorneys' fees and costs incurred throughout the arbitration proceedings. Any award rendered shall be final and conclusive to the Parties and a judgment thereon may be entered in any court of competent jurisdiction, including those sitting in Los Angeles County, California. This binding arbitration provision shall not, however, prevent either Party from seeking equitable or injunctive relief in a federal or state court of competent jurisdiction where the defending Party maintains its principal place of business.


13. MISCELLANEOUS.

If any section or provision of this Agreement, or the application of such section or provision, is held invalid by any court of competent jurisdiction, applicable statute or rule of law, then such Section or provision shall be deemed automatically adjusted to the minimum extent necessary to conform to the requirements for validity as declared at such time and, as so adjusted, shall be deemed a section or provision of this Agreement as though originally included herein. In the event that the section or provision invalidated is of such a nature that it cannot be so adjusted, the section or provision shall be deemed deleted from this Agreement as though such section or provision had never been included herein. In either case, the remaining sections and provisions of this Agreement shall be interpreted so as to best reasonably effect the original intent of the Parties.


14. HEADINGS.

Headings used herein are for reference purposes only and neither limit nor amplify the terms and conditions herein.


15. EXECUTION.

This Agreement may be executed in two or more counterparts, each of which will be deemed an original but all of which together will constitute one and the same instrument. This Agreement may also be executed by electronic signature. By signing below, each signer represents and warrants that he/she is fully competent and authorized to execute this Agreement on behalf of the entity for which he/she purports to represent.`;
  }

  /** Generate downloadable IO HTML document */
  generateIODownloadHtml(io: any): string {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const vendorName = io.vendor?.company_name || 'Vendor';
    const contactName = io.vendor?.contact_name || '';

    // Parse campaign IDs if multi-campaign
    let campaignNames = io.campaign?.name || 'Campaign';
    if (io.campaign_ids) {
      try {
        const ids = JSON.parse(io.campaign_ids);
        if (ids.length > 1) campaignNames = `${ids.length} Campaigns (see terms)`;
      } catch {}
    }

    const statusLabel = {
      pending_vendor: 'Pending Vendor Signature',
      pending_counter: 'Pending GrovLabs Countersignature',
      active: 'Active / Fully Executed',
      terminated: 'Terminated',
      expired: 'Expired',
    }[io.status as string] || io.status;

    const vendorSigBlock = io.vendor_signed_at
      ? `<p><strong>Signed by:</strong> ${io.vendor_sign_name || vendorName}</p>
         <p><strong>Date:</strong> ${new Date(io.vendor_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
         <p><strong>IP:</strong> ${io.vendor_sign_ip || 'N/A'}</p>`
      : `<p style="color:#718096;">Pending vendor signature</p>`;

    const grovlabsSigBlock = io.counter_signed_at
      ? `<p><strong>Signed by:</strong> ${io.counter_sign_by || 'GrovLabs Inc'}</p>
         <p><strong>Date:</strong> ${new Date(io.counter_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
      : `<p style="color:#718096;">Pending GrovLabs countersignature</p>`;

    const termsHtml = (io.terms || '').replace(/\n/g, '<br/>');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${io.io_number} - GrovLabs Inc Insertion Order</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
    body { font-family: 'Georgia', 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
    .header h2 { font-size: 16px; font-weight: normal; margin: 0 0 4px; color: #4a5568; }
    .header p { margin: 4px 0; color: #718096; font-size: 12px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .meta-table td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; }
    .meta-table td:first-child { font-weight: bold; width: 180px; background: #f7fafc; }
    .terms { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px; background: #fafafa; padding: 24px; border: 1px solid #e2e8f0; border-radius: 4px; margin: 20px 0; }
    .sig-section { display: flex; gap: 40px; margin-top: 40px; }
    .sig-box { flex: 1; border: 1px solid #e2e8f0; padding: 20px; border-radius: 4px; }
    .sig-box h3 { margin: 0 0 12px; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .status-active { background: #c6f6d5; color: #22543d; }
    .status-pending { background: #fefcbf; color: #744210; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #1a365d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #2b6cb0; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="header">
    <h1>GROVLABS INC</h1>
    <h2>Insertion Order</h2>
    <p>${io.io_number}</p>
  </div>

  <table class="meta-table">
    <tr><td>IO Number</td><td>${io.io_number}</td></tr>
    <tr><td>Vendor</td><td>${vendorName}</td></tr>
    <tr><td>Contact</td><td>${contactName}</td></tr>
    <tr><td>Campaign(s)</td><td>${campaignNames}</td></tr>
    <tr><td>Payout</td><td>$${Number(io.payout).toFixed(2)} ${this.formatPayoutType(io.payout_type)}</td></tr>
    <tr><td>Billing Cycle</td><td>${io.billing_cycle || 'Bi-Weekly Net 15'}</td></tr>
    <tr><td>Status</td><td><span class="status-badge ${io.status === 'active' ? 'status-active' : 'status-pending'}">${statusLabel}</span></td></tr>
    ${io.effective_date ? `<tr><td>Effective Date</td><td>${new Date(io.effective_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>` : ''}
  </table>

  <div class="terms">${termsHtml}</div>

  <div class="sig-section">
    <div class="sig-box">
      <h3>Vendor / Affiliate</h3>
      ${vendorSigBlock}
    </div>
    <div class="sig-box">
      <h3>GrovLabs Inc</h3>
      ${grovlabsSigBlock}
    </div>
  </div>

  <p style="text-align:center; color:#a0aec0; font-size:11px; margin-top:40px;">
    Generated on ${today} | GrovLabs Inc — Performance Marketing
  </p>
</body>
</html>`;
  }

  // ==================== LEAD PURCHASE AGREEMENT CRUD ====================

  /** Create a Lead Purchase Agreement linked to an IO */
  async createAgreement(ioId: string, vendorId: string): Promise<any> {
    const vendor = await this.prisma.vendor_profile.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new Error('Vendor not found');

    const agreementText = this.buildLeadPurchaseAgreement(
      vendor.company_name,
      vendor.company_state || '___________',
      vendor.entity_type || 'company',
      vendor.company_address || '___________',
      vendor.company_country || undefined,
    );

    const signToken = this.generateSignToken();

    const agreement = await this.prisma.lead_purchase_agreement.create({
      data: {
        io_id: ioId,
        vendor_id: vendorId,
        agreement_text: agreementText,
        sign_token: signToken,
        status: 'pending_vendor',
      },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });

    this.logger.log(`Lead Purchase Agreement created for vendor ${vendor.company_name}, linked to IO ${ioId}`);
    return agreement;
  }

  /** Get agreement by sign token (public) */
  async getAgreementBySignToken(signToken: string): Promise<any> {
    return this.prisma.lead_purchase_agreement.findUnique({
      where: { sign_token: signToken },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
  }

  /** Get agreement by IO id */
  async getAgreementByIOId(ioId: string): Promise<any> {
    return this.prisma.lead_purchase_agreement.findFirst({
      where: { io_id: ioId },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
  }

  /** Get the vendor's master LPA (one per vendor) */
  async getAgreementByVendorId(vendorId: string): Promise<any> {
    return this.prisma.lead_purchase_agreement.findFirst({
      where: { vendor_id: vendorId },
      orderBy: { created_at: 'asc' },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
  }

  /** Vendor signs the agreement */
  async vendorSignAgreement(signToken: string, signName: string, signIp: string): Promise<any> {
    const agreement = await this.prisma.lead_purchase_agreement.findUnique({
      where: { sign_token: signToken },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
    if (!agreement) throw new Error('Agreement not found');
    if (agreement.status !== 'pending_vendor') throw new Error(`Agreement is not pending vendor signature (status: ${agreement.status})`);

    const updated = await this.prisma.lead_purchase_agreement.update({
      where: { id: agreement.id },
      data: {
        vendor_signed_at: new Date(),
        vendor_sign_name: signName,
        vendor_sign_ip: signIp,
        status: 'pending_counter',
      },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });

    this.logger.log(`Lead Purchase Agreement signed by vendor: ${signName}`);
    return updated;
  }

  /** Admin countersigns the agreement */
  async counterSignAgreement(agreementId: string, signBy: string): Promise<any> {
    const agreement = await this.prisma.lead_purchase_agreement.findUnique({
      where: { id: agreementId },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });
    if (!agreement) throw new Error('Agreement not found');
    if (agreement.status !== 'pending_counter') throw new Error(`Agreement is not pending countersignature (status: ${agreement.status})`);

    const updated = await this.prisma.lead_purchase_agreement.update({
      where: { id: agreement.id },
      data: {
        counter_signed_at: new Date(),
        counter_sign_by: signBy,
        status: 'active',
      },
      include: { vendor: true, insertion_order: { include: { campaign: true } } },
    });

    this.logger.log(`Lead Purchase Agreement countersigned by: ${signBy}`);
    return updated;
  }

  /** Generate a downloadable HTML for the signed agreement */
  generateAgreementDownloadHtml(agreement: any): string {
    const vendorName = agreement.vendor?.company_name || 'Vendor';
    const ioNumber = agreement.insertion_order?.io_number || 'N/A';
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const statusLabel = {
      pending_vendor: 'Pending Vendor Signature',
      pending_counter: 'Pending GrovLabs Countersignature',
      active: 'Active / Fully Executed',
      terminated: 'Terminated',
    }[agreement.status as string] || agreement.status;

    const vendorSigBlock = agreement.vendor_signed_at
      ? `<p><strong>Signed by:</strong> ${agreement.vendor_sign_name || vendorName}</p>
         <p><strong>Date:</strong> ${new Date(agreement.vendor_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
         <p><strong>IP:</strong> ${agreement.vendor_sign_ip || 'N/A'}</p>`
      : `<p style="color:#718096;">Pending vendor signature</p>`;

    const grovlabsSigBlock = agreement.counter_signed_at
      ? `<p><strong>Signed by:</strong> ${agreement.counter_sign_by || 'GrovLabs Inc'}</p>
         <p><strong>Date:</strong> ${new Date(agreement.counter_signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
      : `<p style="color:#718096;">Pending GrovLabs countersignature</p>`;

    const escapedText = agreement.agreement_text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lead Purchase Agreement - ${vendorName} | GrovLabs Inc</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
    body { font-family: 'Georgia', 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 1px; }
    .header h2 { font-size: 16px; font-weight: normal; margin: 0 0 4px; color: #4a5568; }
    .header p { margin: 4px 0; color: #718096; font-size: 12px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .meta-table td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; }
    .meta-table td:first-child { font-weight: bold; width: 180px; background: #f7fafc; }
    .terms { white-space: pre-wrap; font-family: 'Georgia', 'Times New Roman', serif; font-size: 12px; background: #fafafa; padding: 24px; border: 1px solid #e2e8f0; border-radius: 4px; margin: 20px 0; line-height: 1.8; }
    .sig-section { display: flex; gap: 40px; margin-top: 40px; }
    .sig-box { flex: 1; border: 1px solid #e2e8f0; padding: 20px; border-radius: 4px; }
    .sig-box h3 { margin: 0 0 12px; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .status-active { background: #c6f6d5; color: #22543d; }
    .status-pending { background: #fefcbf; color: #744210; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #1a365d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #2b6cb0; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="header">
    <h1>GROVLABS INC</h1>
    <h2>Lead Purchase Agreement</h2>
    <p>${vendorName}</p>
  </div>

  <table class="meta-table">
    <tr><td>Vendor</td><td>${vendorName}</td></tr>
    <tr><td>Linked IO</td><td>${ioNumber}</td></tr>
    <tr><td>Status</td><td><span class="status-badge ${agreement.status === 'active' ? 'status-active' : 'status-pending'}">${statusLabel}</span></td></tr>
    <tr><td>Created</td><td>${new Date(agreement.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
  </table>

  <div class="terms">${escapedText}</div>

  <div class="sig-section">
    <div class="sig-box">
      <h3>Vendor / Seller</h3>
      ${vendorSigBlock}
    </div>
    <div class="sig-box">
      <h3>GrovLabs Inc</h3>
      ${grovlabsSigBlock}
    </div>
  </div>

  <p style="text-align:center; color:#a0aec0; font-size:11px; margin-top:40px;">
    Generated on ${today} | GrovLabs Inc — Performance Marketing
  </p>
</body>
</html>`;
  }
}