import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { DiscordService } from '../discord/discord.service.js';
import { EMAIL_CONFIG } from '../config/email.config.js';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';

@Injectable()
export class N2NApplicationService {
  private readonly logger = new Logger(N2NApplicationService.name);
  private resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly discord: DiscordService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private generateIONumber(): string {
    const prefix = 'N2N';
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${date}-${rand}`;
  }

  private generateSignToken(): string {
    return randomBytes(16).toString('hex');
  }

  async createApplication(data: {
    company_name: string;
    organized_in?: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    address_line1?: string;
    address_line2?: string;
    website?: string;
    wants_to_buy: boolean;
    wants_to_sell: boolean;
    verticals?: string;
    estimated_volume?: string;
    traffic_sources?: string;
    current_partners?: string;
    comments?: string;
    referred_by?: string;
    terms_agreed: boolean;
    agreed_ip?: string;
  }) {
    if (!data.wants_to_buy && !data.wants_to_sell) {
      throw new BadRequestException('Must select at least one: buy or sell');
    }

    const application = await this.prisma.network_partner_application.create({
      data: {
        company_name: data.company_name,
        organized_in: data.organized_in,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        website: data.website,
        wants_to_buy: data.wants_to_buy,
        wants_to_sell: data.wants_to_sell,
        verticals: data.verticals,
        estimated_volume: data.estimated_volume,
        traffic_sources: data.traffic_sources,
        current_partners: data.current_partners,
        comments: data.comments,
        referred_by: data.referred_by,
        terms_agreed: data.terms_agreed,
        agreed_ip: data.agreed_ip,
        agreed_at: data.terms_agreed ? new Date() : null,
      },
    });

    this.logger.log(`N2N application created: ${application.company_name} (${application.id})`);

    // Send Discord notification
    await this.sendDiscordNotification(application);

    return application;
  }

  private async sendDiscordNotification(app: any) {
    const direction = [];
    if (app.wants_to_buy) direction.push('BUY from us');
    if (app.wants_to_sell) direction.push('SELL to us');

    try {
      await this.discord.sendEmbed({
        title: '🤝 New N2N Partner Application',
        color: 0xa855f7, // purple for N2N
        fields: [
          { name: 'Company', value: app.company_name, inline: true },
          { name: 'Contact', value: app.contact_name, inline: true },
          { name: 'Email', value: app.contact_email, inline: true },
          { name: 'Phone', value: app.contact_phone, inline: true },
          { name: 'Direction', value: direction.join(' & '), inline: true },
          { name: 'Verticals', value: app.verticals || 'Not specified', inline: true },
          { name: 'Est. Volume', value: app.estimated_volume || 'Not specified', inline: true },
          ...(app.comments ? [{ name: 'Notes', value: app.comments.substring(0, 200), inline: false }] : []),
          { name: 'Actions', value: '[Review in Dashboard](/n2n-applications)', inline: false },
        ],
        footer: { text: `Application ID: ${app.id.slice(0, 8)}` },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`Failed to send Discord notification: ${err.message}`);
    }
  }

  async listApplications(status?: string) {
    return this.prisma.network_partner_application.findMany({
      where: status ? { status } : undefined,
      include: { partner: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async getApplication(id: string) {
    const app = await this.prisma.network_partner_application.findUnique({
      where: { id },
      include: { partner: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async getApplicationByShortId(shortId: string) {
    const apps = await this.prisma.network_partner_application.findMany({
      where: { id: { startsWith: shortId } },
    });
    if (apps.length === 0) throw new NotFoundException('Application not found');
    return apps[0];
  }

  async getApplicationByToken(token: string) {
    const app = await this.prisma.network_partner_application.findUnique({
      where: { status_token: token },
      include: { partner: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async approveApplication(id: string, reviewedBy?: string, ioData?: {
    grovlabs_role?: 'buyer' | 'seller';
    industry?: string;
    lead_type?: string;
    payment_terms?: string;
  }) {
    this.logger.log(`Starting approval for application ${id}`);

    try {
      const app = await this.getApplication(id);
      this.logger.log(`Found application: ${app.company_name}, status: ${app.status}`);

      if (app.status !== 'pending') {
        throw new BadRequestException(`Application is already ${app.status}`);
      }

      // Create the network partner
      this.logger.log('Creating network partner...');
      const partner = await this.prisma.network_partner.create({
        data: {
          legal_name: app.company_name,
          organized_in: app.organized_in,
          contact_name: app.contact_name,
          contact_email: app.contact_email,
          contact_phone: app.contact_phone,
          address_line1: app.address_line1,
          address_line2: app.address_line2,
          can_buy: app.wants_to_buy,
          can_sell: app.wants_to_sell,
          notes: `Applied via website. Verticals: ${app.verticals || 'N/A'}. Volume: ${app.estimated_volume || 'N/A'}`,
        },
      });
      this.logger.log(`Partner created: ${partner.id}`);

      // Create IO automatically
      const defaultRole = app.wants_to_sell ? 'buyer' : 'seller';
      const ioDetails = {
        grovlabs_role: ioData?.grovlabs_role || defaultRole,
        industry: ioData?.industry || app.verticals?.split(',')[0]?.trim() || '',
        lead_type: ioData?.lead_type || 'Inbound Calls',
        payment_terms: ioData?.payment_terms || 'Net 15',
      };

      this.logger.log('Creating IO...');
      const io = await this.prisma.network_io.create({
        data: {
          io_number: this.generateIONumber(),
          network_id: partner.id,
          grovlabs_role: ioDetails.grovlabs_role,
          industry: ioDetails.industry || undefined,
          lead_type: ioDetails.lead_type,
          payment_terms: ioDetails.payment_terms,
          sign_token: this.generateSignToken(),
          io_terms: this.buildIOTerms(partner, ioDetails),
          msa_terms: this.buildMSATerms(partner),
        },
        include: { network: true },
      });
      this.logger.log(`IO created: ${io.io_number}`);

      // Update application status
      const updated = await this.prisma.network_partner_application.update({
        where: { id },
        data: {
          status: 'approved',
          reviewed_at: new Date(),
          reviewed_by: reviewedBy,
          partner_id: partner.id,
        },
        include: { partner: true },
      });
      this.logger.log('Application updated');

      // Build sign URL
      const portalUrl = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:3001');
      const signUrl = `${portalUrl}/n2n/sign/${io.sign_token}`;

      // Send approval email with sign link
      await this.sendApprovalEmail(app.contact_email, app.contact_name, app.company_name, signUrl);

      this.logger.log(`N2N application approved: ${app.company_name} -> Partner ${partner.id}, IO ${io.io_number}`);

      return {
        application: updated,
        partner,
        io,
        sign_url: signUrl,
      };
    } catch (error: any) {
      this.logger.error(`Error approving application ${id}: ${error.message}`);
      this.logger.error(error.stack);
      // Handle unique constraint violation
      if (error.code === 'P2002' && error.meta?.target?.includes('contact_email')) {
        throw new BadRequestException('A partner with this email already exists');
      }
      throw error;
    }
  }

  private async sendApprovalEmail(email: string, contactName: string, companyName: string, signUrl: string): Promise<boolean> {
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:20px;font-weight:600;">Partnership Approved</h2>
  </div>
  <p>Hi ${contactName},</p>
  <p>Great news! Your network partnership application for <b>${companyName}</b> has been approved.</p>
  <p>To get started, please review and sign your Master Services Agreement & Insertion Order:</p>
  <p style="margin:24px 0;">
    <a href="${signUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:500;">Review &amp; Sign Agreement</a>
  </p>
  <p style="color:#718096;">Once signed, we'll countersign and your partnership will be active. You'll receive a confirmation email with next steps.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="color:#718096;font-size:13px;">${EMAIL_CONFIG.companyName} — ${EMAIL_CONFIG.companyTagline}</p>
</div>`;

    try {
      await this.resend.emails.send({
        from: `${EMAIL_CONFIG.companyName} <${process.env.RESEND_FROM_EMAIL || 'noreply@grovlabs.com'}>`,
        to: email,
        replyTo: EMAIL_CONFIG.contactEmail,
        subject: `Partnership Approved — ${companyName}`,
        html,
      });
      this.logger.log(`Approval email sent to ${email}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send approval email: ${err.message}`);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, contactName: string, companyName: string, ioNumber: string): Promise<boolean> {
    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:20px;font-weight:600;">Welcome to ${EMAIL_CONFIG.companyShortName} — Partnership Active</h2>
  </div>
  <p>Hi ${contactName},</p>
  <p>Your Master Services Agreement (<b>${ioNumber}</b>) has been fully executed. Your partnership with ${EMAIL_CONFIG.companyShortName} is now active.</p>

  <div style="background:#f8f9fa;padding:20px;border-radius:6px;margin:20px 0;">
    <h3 style="margin:0 0 12px 0;font-size:16px;">Partnership Details</h3>
    <p><b>Company:</b> ${companyName}</p>
    <p><b>Agreement:</b> ${ioNumber}</p>
    <p><b>Status:</b> Active</p>
  </div>

  <p>We'll be in touch shortly to discuss campaign specifics and get traffic flowing.</p>
  <p>Questions? Reply to this email and we'll get back to you.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
  <p style="color:#718096;font-size:13px;">${EMAIL_CONFIG.companyName} — ${EMAIL_CONFIG.companyTagline}</p>
</div>`;

    try {
      await this.resend.emails.send({
        from: `${EMAIL_CONFIG.companyName} <${process.env.RESEND_FROM_EMAIL || 'noreply@grovlabs.com'}>`,
        to: email,
        replyTo: EMAIL_CONFIG.contactEmail,
        subject: `Welcome to ${EMAIL_CONFIG.companyShortName} — ${companyName}`,
        html,
      });
      this.logger.log(`Welcome email sent to ${email}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send welcome email: ${err.message}`);
      return false;
    }
  }

  async rejectApplication(id: string, reason?: string, reviewedBy?: string) {
    const app = await this.getApplication(id);

    if (app.status !== 'pending') {
      throw new BadRequestException(`Application is already ${app.status}`);
    }

    const updated = await this.prisma.network_partner_application.update({
      where: { id },
      data: {
        status: 'rejected',
        status_reason: reason,
        reviewed_at: new Date(),
        reviewed_by: reviewedBy,
      },
    });

    this.logger.log(`N2N application rejected: ${app.company_name}`);

    return updated;
  }

  async updateApplication(id: string, data: Partial<{
    company_name: string;
    organized_in: string;
    contact_name: string;
    contact_email: string;
    contact_phone: string;
    address_line1: string;
    address_line2: string;
    website: string;
    wants_to_buy: boolean;
    wants_to_sell: boolean;
    verticals: string;
    estimated_volume: string;
    traffic_sources: string;
    current_partners: string;
    comments: string;
    referred_by: string;
  }>) {
    return this.prisma.network_partner_application.update({
      where: { id },
      data,
    });
  }

  async deleteApplication(id: string) {
    return this.prisma.network_partner_application.delete({ where: { id } });
  }

  private buildIOTerms(partner: any, data: any): string {
    const buyerChecked = data.grovlabs_role === 'buyer' ? '☑' : '☐';
    const sellerChecked = data.grovlabs_role === 'seller' ? '☑' : '☐';

    return `
INSERTION ORDER
Grovlabs • Campaign Cover Sheet

================================================================================
GROVLABS                                    COUNTERPARTY
================================================================================
Grovlabs                                    ${partner.legal_name}
Legal Name (including corporate designator) Legal Name (including corporate designator)

Delaware                                    ${partner.organized_in || ''}
Organized In                                Organized In

Usman Javed                                 ${partner.contact_name}
Contact Name                                Contact Name

+1 (754) 344-0773                           ${partner.contact_phone}
Contact Phone Number                        Contact Phone Number

uj@grovlabs.com                             ${partner.contact_email}
Contact Email                               Contact Email

                                            ${partner.address_line1 || ''}
Business Address 1                          Business Address 1

                                            ${partner.address_line2 || ''}
Business Address 2                          Business Address 2

================================================================================
CAMPAIGN DETAILS
================================================================================

Grovlabs acts as: ${buyerChecked} Buyer  ${sellerChecked} Seller

Industry / Vertical:      ${data.industry || '_______________'}
Lead Type:                ${data.lead_type || '_______________'}
Geo:                      ${data.geo || '_______________'}
Daily Cap:                ${data.daily_cap || '_______________'}
Concurrency:              ${data.concurrency || '_______________'}
Payment Terms:            ${data.payment_terms || '_______________'}
Other Terms:              ${data.other_terms || '_______________'}

Start Date:               ${data.start_date ? new Date(data.start_date).toLocaleDateString() : '_______________'}
End Date:                 ${data.end_date ? new Date(data.end_date).toLocaleDateString() : '_______________'}
Compensation Type:        ${data.compensation_type || '_______________'}
Compensation Amount:      ${data.compensation_amount ? '$' + Number(data.compensation_amount).toFixed(2) : '_______________'}
Minimum Duration:         ${data.minimum_duration ? data.minimum_duration + ' seconds' : '_______________'}
Hours of Operation:       ${data.hours_of_operation || '_______________'}
Payout Threshold:         ${data.payout_threshold ? '$' + Number(data.payout_threshold).toFixed(2) : '_______________'}

The Parties may mutually agree in writing (including by email) to adjust any campaign
detail above from time to time, including lead type, daily cap, compensation type, and
compensation amount. An adjustment takes effect prospectively only, and the terms
applicable to a Lead are those in effect at the time the Lead is delivered.

For the mutual promises herein and other good and valuable consideration, Grovlabs and
the counterparty identified above (each a "Party," together the "Parties") agree to this
Insertion Order (the "IO") as of the latest signature date below (the "Effective Date").
This IO is governed by the Master Services Agreement (the "MSA") attached hereto and
incorporated by reference. Capitalized terms not defined in this IO have the meanings
given in the MSA. In the event of a conflict between the MSA and this IO, this IO
controls solely with respect to the campaign described herein.

================================================================================
SIGNATURES
================================================================================

Grovlabs                                    COUNTERPARTY

______________________________              ______________________________
Signature                                   Signature

______________________________              ______________________________
Name                                        Name

______________________________              ______________________________
Title                                       Title

______________________________              ______________________________
Date                                        Date
`.trim();
  }

  private buildMSATerms(partner: any): string {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return `
MASTER SERVICES AGREEMENT
Grovlabs • Lead and Call Purchase / Supply

THIS MASTER SERVICES AGREEMENT ("MSA" or "Agreement") is dated ${today}, by and between
Grovlabs, a Delaware corporation located at [Address] ("Grovlabs"), and ${partner.legal_name},
a ${partner.organized_in || '____________'} located at ${partner.address_line1 || '____________'}
("Counterparty"), each a "Party" and together the "Parties."

1. STRUCTURE AND ROLE DESIGNATION

1.1 Reciprocal structure. The Parties may transact in either direction. For each IO, the Party
delivering Leads is the "Seller" and the Party purchasing Leads is the "Buyer," as designated
on the face of that IO. A Party may act as Seller under one IO and as Buyer under another,
concurrently. Every obligation, representation, and warranty stated as applying to the Seller
applies to whichever Party occupies that role under the relevant IO, and likewise for the Buyer.

1.2 Non-exclusive. This Agreement is non-exclusive. Neither Party is obligated to send or
purchase any minimum volume.

1.3 Order of precedence. Where an IO conflicts with this Agreement, the IO controls as to the
campaign it describes, and only as to the specific term in conflict. This Agreement governs in
all other respects. No IO may vary Sections 9 through 13 except by written amendment signed
by both Parties.

2. DEFINITIONS

"Applicable Law" means all federal, state, and local laws, statutes, rules, and regulations
relating to online and direct marketing, telemarketing, lead generation, advertising, and data
protection, including the Telephone Consumer Protection Act, 47 U.S.C. 227 and 47 C.F.R. 64.1200
("TCPA"); the Telemarketing Sales Rule; the Do Not Call Implementation Act; CAN-SPAM; the
Federal Trade Commission Act and FTC rules and opinions; the Gramm-Leach-Bliley Act; the Fair
Credit Reporting Act; the California Consumer Privacy Act; California Business & Professions
Code § 17529; Florida SB 1120 and the Florida Do Not Call Act; and any successor or comparable
state statute, each as amended.

"Call" means a telephone call delivered under an IO for any inbound call or warm transfer program.

"Consumer" means an individual who requests or responds to information for goods or services,
whether by request form, telephone call, or click.

"Lead" means Lead Data delivered under an IO for any lead data program.

"Lead Data" means non-public, personally identifiable information obtained from a Consumer.

"Invalid Lead" means a Lead or Call that: (i) did not meet the filtering criteria in the
applicable IO but was nonetheless delivered; (ii) has incorrect or missing phone information;
(iii) is a duplicate or contains a clear and meaningful error; (iv) was generated by a
computer-generated user, robot, script, redirect, or other automated or fraudulent method
designed to appear to be a live person; (v) was not submitted by the Consumer in real time;
(vi) was incentivized; or (vii) falls below the minimum billable duration stated in the
applicable IO.

"Sub-Provider" means any affiliate, publisher, vendor, or other third party a Seller engages
to generate or deliver traffic.

"Valid Lead" means a Lead submitted by a Consumer on his or her own behalf that passes Buyer's
validity checks, came from a unique user, was delivered to and accepted by Buyer, and was not
generated by fraudulent means.

3. COMPENSATION AND PAYMENT

(a) Buyer shall pay Seller at the rates stated in the applicable IO, which may include dynamic
or ping/post pricing. Pricing in the IO is part of this Agreement.

(b) Billing cycle, payment terms, and any payout threshold are as stated in the IO. Where the
IO is silent, Seller shall invoice monthly for the preceding month and Buyer shall pay Net 30.

(c) Amounts held below a payout threshold remain owed, carry forward to the next cycle, and
become payable in full on termination regardless of the threshold.

(d) A change to pricing takes effect only upon a subsequent IO or by email with the affirmative
written consent of both Parties, and applies prospectively only.

(e) Any disputed invoice shall be settled in good faith. Undisputed amounts remain payable on
schedule notwithstanding a dispute as to other amounts.

(f) Where both Parties owe amounts to one another, either Party may on written notice set off
undisputed amounts owed to it against undisputed amounts it owes and settle the net balance.

4. RETURNS AND INVALID LEADS

(a) Buyer may submit for refund Leads it determines in its commercially reasonable discretion
to be Invalid Leads, and shall support each request with the applicable Lead identifiers and
the reason for the dispute.

(b) No Lead may be submitted for refund after 5:00 p.m. Eastern on the tenth (10th) day of the
calendar month following the month of purchase, except where the claim arises from fraud, or
from a defect in consent that Buyer could not reasonably have discovered within that period,
in which case the period is ninety (90) days from delivery.

(c) Buyer shall not reject Leads on the basis of conversion rate, close rate, or downstream
sales performance alone.

5. CONSENT RECORDS AND PROOF

Seller shall retain, for each Lead and Call, records sufficient to establish prior express
written consent where Applicable Law requires it. Seller shall produce those records for any
identified Lead within two (2) business days of written request. Records shall include, as
applicable, screenshots of the notice and consent language on the source from which the Lead
Data was collected, the source URL, the originating IP address, and the date and time stamp
of collection.

Seller shall retain these records for no less than five (5) years. Leads for which a valid
consent record is not produced within the period stated above are non-billable and may be
charged back.

6. SUB-PROVIDERS AND TRAFFIC SOURCES

Seller shall not deliver traffic sourced from a Sub-Provider that has not been disclosed to
and approved by Buyer in writing. Seller is responsible for the acts and omissions of each
Sub-Provider it engages as if those acts and omissions were Seller's own.

7. DO NOT CALL AND UNSUBSCRIBE

Where a Consumer asks either Party to be placed on a do-not-call or unsubscribe list, that
Party shall take commercially reasonable steps to add the Consumer to such lists as required
by Applicable Law and as is standard in the industry.

8. CONFIDENTIALITY

(a) "Confidential Information" means information marked confidential, or which by its nature
or the circumstances of disclosure should reasonably be understood to be confidential or
proprietary.

(b) Each Party shall keep the other's Confidential Information strictly confidential, protect
it with no less than a reasonable degree of care, use it only to perform or receive services
under this Agreement, and disclose it only to employees with a need to know.

(c) The terms of this Agreement and of each IO are the Confidential Information of both Parties.

9. WARRANTIES

9.1 Mutual - Each Party has the right, power, and authority to enter into this Agreement.

9.2 Seller warranties - All Leads and Calls have been lawfully collected and compiled and do
not violate the rights of any third party.

10. DISCLAIMER OF WARRANTIES

EXCEPT FOR THE EXPRESS REPRESENTATIONS AND WARRANTIES IN THIS AGREEMENT, NEITHER PARTY MAKES
ANY, AND EACH DISCLAIMS ALL, REPRESENTATIONS AND WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.

11. LIMITATION OF LIABILITY

NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR INDIRECT, SPECIAL, INCIDENTAL, PUNITIVE, OR
CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF GOODWILL, LOST PROFITS, WORK STOPPAGE, OR EQUIPMENT
FAILURE, EVEN IF ADVISED OF THE POSSIBILITY.

12. INDEMNIFICATION

Each Party shall indemnify, defend, and hold harmless the other Party from any third-party
claims arising from the indemnifying Party's breach of this Agreement or violation of
Applicable Law.

13. TERM AND TERMINATION

(a) This Agreement runs for twelve (12) months from the execution date and renews automatically
for successive twelve (12) month terms unless either Party gives notice of non-renewal at
least thirty (30) days before the end of the then-current term.

(b) Either Party may terminate this Agreement or any IO on ten (10) business days written notice.

(c) Either Party may terminate immediately on material breach by the other Party that remains
uncured five (5) business days after written notice.

14. MISCELLANEOUS

14.1 No waiver. No waiver of any provision or breach constitutes a continuing waiver.

14.2 Governing law. This Agreement is governed by the laws of Delaware.

14.3 Assignment. Neither Party may assign this Agreement without the other Party's prior
written consent.

14.4 Entire agreement. This Agreement, together with all IOs, is the entire agreement on
this subject.

14.5 Counterparts and e-signatures. This Agreement and any IO may be signed in counterparts
and by electronic signature.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the dates below.

================================================================================
SIGNATURES
================================================================================

Grovlabs                                    COUNTERPARTY

______________________________              ______________________________
Signature                                   Signature

______________________________              ______________________________
Name                                        Name

______________________________              ______________________________
Title                                       Title

______________________________              ______________________________
Date                                        Date
`.trim();
  }
}
