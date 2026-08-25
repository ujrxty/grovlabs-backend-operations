import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DiscordService } from '../discord/discord.service.js';
import { randomBytes } from 'crypto';

@Injectable()
export class N2NService {
  private readonly logger = new Logger(N2NService.name);
  private appService: any = null; // Lazy-loaded to avoid circular dep

  constructor(
    private readonly prisma: PrismaService,
    private readonly discord: DiscordService,
  ) {}

  setApplicationService(svc: any): void {
    this.appService = svc;
  }

  // ============================================
  // Network Partner CRUD
  // ============================================

  async createPartner(data: {
    legal_name: string;
    organized_in?: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    address_line1?: string;
    address_line2?: string;
    can_buy?: boolean;
    can_sell?: boolean;
    notes?: string;
  }) {
    return this.prisma.network_partner.create({
      data: {
        legal_name: data.legal_name,
        organized_in: data.organized_in,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        can_buy: data.can_buy ?? false,
        can_sell: data.can_sell ?? false,
        notes: data.notes,
      },
    });
  }

  async updatePartner(id: string, data: Partial<{
    legal_name: string;
    organized_in: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    address_line1: string;
    address_line2: string;
    can_buy: boolean;
    can_sell: boolean;
    status: string;
    notes: string;
  }>) {
    return this.prisma.network_partner.update({
      where: { id },
      data,
    });
  }

  async getPartner(id: string) {
    const partner = await this.prisma.network_partner.findUnique({
      where: { id },
      include: { network_ios: true },
    });
    if (!partner) throw new NotFoundException('Network partner not found');
    return partner;
  }

  async listPartners(status?: string) {
    return this.prisma.network_partner.findMany({
      where: status ? { status } : undefined,
      include: { network_ios: { orderBy: { created_at: 'desc' }, take: 5 } },
      orderBy: { created_at: 'desc' },
    });
  }

  // ============================================
  // IO Generation
  // ============================================

  private generateIONumber(): string {
    const prefix = 'N2N';
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${date}-${rand}`;
  }

  private generateSignToken(): string {
    return randomBytes(16).toString('hex');
  }

  async createIO(data: {
    network_id: string;
    grovlabs_role: 'buyer' | 'seller';
    industry?: string;
    lead_type?: string;
    geo?: string;
    daily_cap?: string;
    concurrency?: string;
    payment_terms?: string;
    start_date?: Date;
    end_date?: Date;
    compensation_type?: string;
    compensation_amount?: number;
    minimum_duration?: number;
    hours_of_operation?: string;
    payout_threshold?: number;
    other_terms?: string;
  }) {
    const partner = await this.getPartner(data.network_id);

    // Validate role
    if (data.grovlabs_role === 'buyer' && !partner.can_sell) {
      throw new BadRequestException('This network is not configured to sell');
    }
    if (data.grovlabs_role === 'seller' && !partner.can_buy) {
      throw new BadRequestException('This network is not configured to buy');
    }

    const io_number = this.generateIONumber();
    const sign_token = this.generateSignToken();

    // Generate IO terms (cover sheet)
    const io_terms = this.buildIOTerms(partner, data);

    // Generate MSA terms
    const msa_terms = this.buildMSATerms(partner);

    return this.prisma.network_io.create({
      data: {
        io_number,
        network_id: data.network_id,
        grovlabs_role: data.grovlabs_role,
        industry: data.industry,
        lead_type: data.lead_type,
        geo: data.geo,
        daily_cap: data.daily_cap,
        concurrency: data.concurrency,
        payment_terms: data.payment_terms,
        start_date: data.start_date,
        end_date: data.end_date,
        compensation_type: data.compensation_type,
        compensation_amount: data.compensation_amount,
        minimum_duration: data.minimum_duration,
        hours_of_operation: data.hours_of_operation,
        payout_threshold: data.payout_threshold,
        other_terms: data.other_terms,
        io_terms,
        msa_terms,
        sign_token,
      },
      include: { network: true },
    });
  }

  async getIO(id: string) {
    const io = await this.prisma.network_io.findUnique({
      where: { id },
      include: { network: true },
    });
    if (!io) throw new NotFoundException('Network IO not found');
    return io;
  }

  async getIOByToken(token: string) {
    const io = await this.prisma.network_io.findUnique({
      where: { sign_token: token },
      include: { network: true },
    });
    if (!io) throw new NotFoundException('IO not found');
    return io;
  }

  async listIOs(status?: string, networkId?: string) {
    return this.prisma.network_io.findMany({
      where: {
        ...(networkId ? { network_id: networkId } : {}),
        ...(status ? { status } : {}),
      },
      include: { network: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async signIO(token: string, name: string, title?: string, ip?: string) {
    const io = await this.getIOByToken(token);

    if (io.status !== 'pending_network') {
      throw new BadRequestException('IO is not pending network signature');
    }

    const updated = await this.prisma.network_io.update({
      where: { id: io.id },
      data: {
        status: 'pending_counter',
        network_signed_at: new Date(),
        network_sign_name: name,
        network_sign_title: title,
        network_sign_ip: ip,
      },
      include: { network: true },
    });

    // Notify admin via Discord
    this.discord.sendEmbed({
      title: '✍️ N2N Agreement Signed',
      color: 0x3b82f6,
      fields: [
        { name: 'Company', value: updated.network.legal_name, inline: true },
        { name: 'IO Number', value: updated.io_number, inline: true },
        { name: 'Signed By', value: `${name}${title ? ` (${title})` : ''}`, inline: true },
        { name: 'Action Required', value: 'Countersign in Dashboard → Network Partners', inline: false },
      ],
      footer: { text: 'GrovLabs N2N' },
      timestamp: new Date().toISOString(),
    }).catch(e => this.logger.warn(`Discord notification failed: ${e.message}`));

    return updated;
  }

  async countersignIO(id: string, name: string, title?: string, ip?: string) {
    const io = await this.getIO(id);

    if (io.status !== 'pending_counter') {
      throw new BadRequestException('IO is not pending countersignature');
    }

    const updated = await this.prisma.network_io.update({
      where: { id },
      data: {
        status: 'active',
        counter_signed_at: new Date(),
        counter_sign_name: name,
        counter_sign_title: title,
        counter_sign_ip: ip,
      },
      include: { network: true },
    });

    // Send welcome email to partner
    if (this.appService) {
      this.appService.sendWelcomeEmail(
        updated.network.contact_email,
        updated.network.contact_name,
        updated.network.legal_name,
        updated.io_number,
      ).catch((e: any) => this.logger.warn(`Welcome email failed: ${e.message}`));
    }

    // Notify via Discord
    this.discord.sendEmbed({
      title: '✅ N2N Partnership Active',
      color: 0x10b981,
      fields: [
        { name: 'Company', value: updated.network.legal_name, inline: true },
        { name: 'IO Number', value: updated.io_number, inline: true },
        { name: 'Status', value: 'Fully Executed', inline: true },
      ],
      footer: { text: 'GrovLabs N2N' },
      timestamp: new Date().toISOString(),
    }).catch(e => this.logger.warn(`Discord notification failed: ${e.message}`));

    return updated;
  }

  async getIOForSigning(token: string) {
    const io = await this.getIOByToken(token);
    return {
      io_number: io.io_number,
      grovlabs_role: io.grovlabs_role,
      network: {
        legal_name: io.network.legal_name,
        contact_name: io.network.contact_name,
        contact_email: io.network.contact_email,
      },
      industry: io.industry,
      lead_type: io.lead_type,
      geo: io.geo,
      payment_terms: io.payment_terms,
      compensation_type: io.compensation_type,
      compensation_amount: io.compensation_amount,
      start_date: io.start_date,
      end_date: io.end_date,
      status: io.status,
      io_terms: io.io_terms,
      msa_terms: io.msa_terms,
    };
  }

  async sendSignRequestEmail(id: string) {
    const io = await this.getIO(id);
    const signUrl = `${process.env.VENDOR_PORTAL_URL || 'https://partners.grovlabs.com'}/n2n/sign/${io.sign_token}`;
    this.logger.log(`Sign request for N2N IO ${io.io_number}: ${signUrl}`);
    return { success: true, io_number: io.io_number, sign_url: signUrl };
  }

  // ============================================
  // Document Generation
  // ============================================

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

                                            ${partner.organized_in || ''}
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

  // ============================================
  // HTML Views
  // ============================================

  async generateIODownloadHtml(id: string): Promise<string> {
    const io = await this.getIO(id);
    return this.buildFullIODocument(io);
  }

  async generateIOHtml(token: string): Promise<string> {
    const io = await this.getIOByToken(token);
    return this.buildIOHtml(io);
  }

  private buildFullIODocument(io: any): string {
    const partner = io.network;
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const buyerChecked = io.grovlabs_role === 'buyer' ? '☑' : '☐';
    const sellerChecked = io.grovlabs_role === 'seller' ? '☑' : '☐';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Grovlabs MSA & IO - ${io.io_number}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; padding: 20px; }
      .page-break { page-break-before: always; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      max-width: 850px;
      margin: 0 auto;
      padding: 40px 50px;
      color: #1a1a1a;
      line-height: 1.5;
      font-size: 11pt;
    }
    h1 { font-size: 28px; margin: 0 0 5px 0; text-align: center; font-weight: bold; }
    h2 { font-size: 13px; text-align: center; color: #666; font-weight: normal; margin: 0 0 30px 0; }
    h3 { font-size: 13px; font-weight: bold; margin: 25px 0 10px 0; text-transform: uppercase; }
    .header-line { border-top: 1px solid #333; margin: 20px 0; }

    .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
    .party-header { font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 15px; text-align: center; background: #f5f5f5; padding: 8px; }
    .field-row { margin-bottom: 12px; }
    .field-value { border-bottom: 1px solid #333; min-height: 20px; padding: 2px 0; font-size: 11pt; }
    .field-label { font-size: 9px; color: #666; margin-top: 2px; }

    .campaign-section { margin: 30px 0; }
    .campaign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 40px; }
    .campaign-row { display: flex; align-items: baseline; gap: 10px; }
    .campaign-label { font-weight: 500; white-space: nowrap; min-width: 140px; }
    .campaign-value { flex: 1; border-bottom: 1px solid #333; min-height: 18px; }
    .checkbox-row { margin: 15px 0; }

    .other-terms { margin-top: 15px; }
    .other-terms-box { border-bottom: 1px solid #333; min-height: 40px; margin-top: 5px; }

    .legal-text { font-size: 10pt; color: #444; margin: 20px 0; text-align: justify; }

    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 40px; }
    .sig-block h4 { font-weight: bold; font-size: 12px; margin: 0 0 20px 0; }
    .sig-line { border-bottom: 1px solid #333; height: 25px; margin-bottom: 3px; }
    .sig-label { font-size: 9px; color: #666; font-style: italic; margin-bottom: 15px; }
    .sig-filled { font-size: 11pt; padding: 2px 0; }

    .page-footer { text-align: center; font-size: 9px; color: #666; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }

    .msa-section { margin: 20px 0; }
    .msa-section h3 { font-size: 12px; margin: 20px 0 10px 0; }
    .msa-text { font-size: 10pt; text-align: justify; }
    .msa-text p { margin: 8px 0; }
    .msa-text ol, .msa-text ul { margin: 8px 0; padding-left: 25px; }
    .msa-text li { margin: 5px 0; }
    .definition { margin: 8px 0; }
    .def-term { font-weight: 600; }

    .print-btn {
      position: fixed; top: 20px; right: 20px;
      padding: 12px 24px;
      background: #1a1a1a; color: white;
      border: none; border-radius: 6px;
      cursor: pointer; font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .print-btn:hover { background: #333; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

  <!-- PAGE 1: IO COVER SHEET -->
  <h1>INSERTION ORDER</h1>
  <h2>Grovlabs • Campaign Cover Sheet</h2>
  <div class="header-line"></div>

  <div class="parties-grid">
    <div>
      <div class="party-header">GROVLABS</div>
      <div class="field-row">
        <div class="field-value">Grovlabs</div>
        <div class="field-label">Legal Name (including corporate designator)</div>
      </div>
      <div class="field-row">
        <div class="field-value">Delaware</div>
        <div class="field-label">Organized In</div>
      </div>
      <div class="field-row">
        <div class="field-value">Usman Javed</div>
        <div class="field-label">Contact Name</div>
      </div>
      <div class="field-row">
        <div class="field-value">+1 (754) 344-0773</div>
        <div class="field-label">Contact Phone Number</div>
      </div>
      <div class="field-row">
        <div class="field-value">uj@grovlabs.com</div>
        <div class="field-label">Contact Email</div>
      </div>
      <div class="field-row">
        <div class="field-value"></div>
        <div class="field-label">Business Address 1</div>
      </div>
      <div class="field-row">
        <div class="field-value"></div>
        <div class="field-label">Business Address 2</div>
      </div>
    </div>
    <div>
      <div class="party-header">COUNTERPARTY</div>
      <div class="field-row">
        <div class="field-value">${partner.legal_name}</div>
        <div class="field-label">Legal Name (including corporate designator)</div>
      </div>
      <div class="field-row">
        <div class="field-value">${partner.organized_in || ''}</div>
        <div class="field-label">Organized In</div>
      </div>
      <div class="field-row">
        <div class="field-value">${partner.contact_name}</div>
        <div class="field-label">Contact Name</div>
      </div>
      <div class="field-row">
        <div class="field-value">${partner.contact_phone}</div>
        <div class="field-label">Contact Phone Number</div>
      </div>
      <div class="field-row">
        <div class="field-value">${partner.contact_email}</div>
        <div class="field-label">Contact Email</div>
      </div>
      <div class="field-row">
        <div class="field-value">${partner.address_line1 || ''}</div>
        <div class="field-label">Business Address 1</div>
      </div>
      <div class="field-row">
        <div class="field-value">${partner.address_line2 || ''}</div>
        <div class="field-label">Business Address 2</div>
      </div>
    </div>
  </div>

  <h3>CAMPAIGN DETAILS</h3>

  <div class="checkbox-row">
    <strong>Grovlabs acts as</strong> &nbsp; ${buyerChecked} Buyer &nbsp;&nbsp; ${sellerChecked} Seller
  </div>

  <div class="campaign-grid">
    <div class="campaign-row">
      <span class="campaign-label">Industry / Vertical</span>
      <span class="campaign-value">${io.industry || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Start Date</span>
      <span class="campaign-value">${io.start_date ? new Date(io.start_date).toLocaleDateString() : ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Lead Type</span>
      <span class="campaign-value">${io.lead_type || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">End Date</span>
      <span class="campaign-value">${io.end_date ? new Date(io.end_date).toLocaleDateString() : ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Geo</span>
      <span class="campaign-value">${io.geo || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Compensation Type</span>
      <span class="campaign-value">${io.compensation_type || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Daily Cap</span>
      <span class="campaign-value">${io.daily_cap || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Compensation Amount</span>
      <span class="campaign-value">${io.compensation_amount ? '$' + Number(io.compensation_amount).toFixed(2) : ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Concurrency</span>
      <span class="campaign-value">${io.concurrency || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Minimum Duration</span>
      <span class="campaign-value">${io.minimum_duration ? io.minimum_duration + ' seconds' : ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Payment Terms</span>
      <span class="campaign-value">${io.payment_terms || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Hours of Operation</span>
      <span class="campaign-value">${io.hours_of_operation || ''}</span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label"></span>
      <span class="campaign-value" style="border: none;"></span>
    </div>
    <div class="campaign-row">
      <span class="campaign-label">Payout Threshold</span>
      <span class="campaign-value">${io.payout_threshold ? '$' + Number(io.payout_threshold).toFixed(2) : ''}</span>
    </div>
  </div>

  <div class="other-terms">
    <strong>Other Terms</strong>
    <div class="other-terms-box">${io.other_terms || ''}</div>
  </div>

  <p class="legal-text">
    The Parties may mutually agree in writing (including by email) to adjust any campaign detail above from time to time, including lead type, daily cap, compensation type, and compensation amount. An adjustment takes effect prospectively only, and the terms applicable to a Lead are those in effect at the time the Lead is delivered.
  </p>
  <p class="legal-text">
    For the mutual promises herein and other good and valuable consideration, Grovlabs and the counterparty identified above (each a "Party," together the "Parties") agree to this Insertion Order (the "IO") as of the latest signature date below (the "Effective Date"). This IO is governed by the Master Services Agreement (the "MSA") attached hereto and incorporated by reference. Capitalized terms not defined in this IO have the meanings given in the MSA. In the event of a conflict between the MSA and this IO, this IO controls solely with respect to the campaign described herein.
  </p>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 1</div>

  <!-- PAGE 2: SIGNATURES -->
  <div class="page-break"></div>

  <div class="signatures" style="margin-top: 60px;">
    <div class="sig-block">
      <h4>Grovlabs</h4>
      ${io.counter_signed_at ? `
        <div class="sig-filled">${io.counter_sign_name || ''}</div>
        <div class="sig-label">Signature</div>
        <div class="sig-filled">${io.counter_sign_name || ''}</div>
        <div class="sig-label">Name</div>
        <div class="sig-filled">${io.counter_sign_title || ''}</div>
        <div class="sig-label">Title</div>
        <div class="sig-filled">${new Date(io.counter_signed_at).toLocaleDateString()}</div>
        <div class="sig-label">Date</div>
      ` : `
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
        <div class="sig-line"></div>
        <div class="sig-label">Name</div>
        <div class="sig-line"></div>
        <div class="sig-label">Title</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
      `}
    </div>
    <div class="sig-block">
      <h4>COUNTERPARTY</h4>
      ${io.network_signed_at ? `
        <div class="sig-filled">${io.network_sign_name || ''}</div>
        <div class="sig-label">Signature</div>
        <div class="sig-filled">${io.network_sign_name || ''}</div>
        <div class="sig-label">Name</div>
        <div class="sig-filled">${io.network_sign_title || ''}</div>
        <div class="sig-label">Title</div>
        <div class="sig-filled">${new Date(io.network_signed_at).toLocaleDateString()}</div>
        <div class="sig-label">Date</div>
      ` : `
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
        <div class="sig-line"></div>
        <div class="sig-label">Name</div>
        <div class="sig-line"></div>
        <div class="sig-label">Title</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
      `}
    </div>
  </div>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 2</div>

  <!-- PAGE 3: MSA START -->
  <div class="page-break"></div>

  <h1>MASTER SERVICES AGREEMENT</h1>
  <h2>Grovlabs • Lead and Call Purchase / Supply</h2>
  <div class="header-line"></div>

  <div class="msa-text">
    <p>
      <strong>THIS MASTER SERVICES AGREEMENT</strong> ("MSA" or "Agreement") is dated <u>&nbsp;${today}&nbsp;</u>, by and between <strong>Grovlabs</strong>, a Delaware corporation located at ________________________ ("Grovlabs"), and <strong>${partner.legal_name}</strong>, a ${partner.organized_in || '____________'} located at ${partner.address_line1 || '____________'} ("Counterparty"), each a "Party" and together the "Parties."
    </p>

    <h3>1. STRUCTURE AND ROLE DESIGNATION</h3>
    <p><strong>1.1 Reciprocal structure.</strong> The Parties may transact in either direction. For each IO, the Party delivering Leads is the "Seller" and the Party purchasing Leads is the "Buyer," as designated on the face of that IO. A Party may act as Seller under one IO and as Buyer under another, concurrently. Every obligation, representation, and warranty stated as applying to the Seller applies to whichever Party occupies that role under the relevant IO, and likewise for the Buyer.</p>
    <p><strong>1.2 Non-exclusive.</strong> This Agreement is non-exclusive. Neither Party is obligated to send or purchase any minimum volume.</p>
    <p><strong>1.3 Order of precedence.</strong> Where an IO conflicts with this Agreement, the IO controls as to the campaign it describes, and only as to the specific term in conflict. This Agreement governs in all other respects. No IO may vary Sections 9 through 13 except by written amendment signed by both Parties.</p>

    <h3>2. DEFINITIONS</h3>
    <p class="definition"><span class="def-term">"Applicable Law"</span> means all federal, state, and local laws, statutes, rules, and regulations relating to online and direct marketing, telemarketing, lead generation, advertising, and data protection, including the Telephone Consumer Protection Act, 47 U.S.C. 227 and 47 C.F.R. 64.1200 ("TCPA"); the Telemarketing Sales Rule; the Do Not Call Implementation Act; CAN-SPAM; the Federal Trade Commission Act and FTC rules and opinions; the Gramm-Leach-Bliley Act; the Fair Credit Reporting Act; the California Consumer Privacy Act; California Business & Professions Code § 17529; Florida SB 1120 and the Florida Do Not Call Act; and any successor or comparable state statute, each as amended.</p>
    <p class="definition"><span class="def-term">"Call"</span> means a telephone call delivered under an IO for any inbound call or warm transfer program.</p>
    <p class="definition"><span class="def-term">"Consumer"</span> means an individual who requests or responds to information for goods or services, whether by request form, telephone call, or click.</p>
    <p class="definition"><span class="def-term">"Lead"</span> means Lead Data delivered under an IO for any lead data program.</p>
    <p class="definition"><span class="def-term">"Lead Data"</span> means non-public, personally identifiable information obtained from a Consumer.</p>
    <p class="definition"><span class="def-term">"Invalid Lead"</span> means a Lead or Call that: (i) did not meet the filtering criteria in the applicable IO but was nonetheless delivered; (ii) has incorrect or missing phone information; (iii) is a duplicate or contains a clear and meaningful error; (iv) was generated by a computer-generated user, robot, script, redirect, or other automated or fraudulent method designed to appear to be a live person; (v) was not submitted by the Consumer in real time; (vi) was incentivized; or (vii) falls below the minimum billable duration stated in the applicable IO.</p>
    <p class="definition"><span class="def-term">"Prohibited Content"</span> means content that infringes the rights of any person; offers incentives to click, including cash, points, prizes, "free" items, or contest entries; contains or promotes obscenity, pornography, violence, firearms, defamation, hate speech, gambling, illegal substances, software piracy, or hacking; is not written in English; is defamatory or libelous; would be found highly objectionable by a reasonable person; or contains malware or other destructive code.</p>
    <p class="definition"><span class="def-term">"Sub-Provider"</span> means any affiliate, publisher, vendor, or other third party a Seller engages to generate or deliver traffic.</p>
    <p class="definition"><span class="def-term">"Valid Lead"</span> means a Lead submitted by a Consumer on his or her own behalf that passes Buyer's validity checks, came from a unique user, was delivered to and accepted by Buyer, and was not generated by fraudulent means.</p>

    <h3>3. COMPENSATION AND PAYMENT</h3>
    <ol type="a">
      <li>Buyer shall pay Seller at the rates stated in the applicable IO, which may include dynamic or ping/post pricing. Pricing in the IO is part of this Agreement.</li>
      <li>Billing cycle, payment terms, and any payout threshold are as stated in the IO. Where the IO is silent, Seller shall invoice monthly for the preceding month and Buyer shall pay Net 30.</li>
      <li>Amounts held below a payout threshold remain owed, carry forward to the next cycle, and become payable in full on termination regardless of the threshold.</li>
      <li>A change to pricing takes effect only upon a subsequent IO or by email with the affirmative written consent of both Parties, and applies prospectively only.</li>
      <li>Any disputed invoice shall be settled in good faith. Undisputed amounts remain payable on schedule notwithstanding a dispute as to other amounts.</li>
      <li>Where both Parties owe amounts to one another, either Party may on written notice set off undisputed amounts owed to it against undisputed amounts it owes and settle the net balance.</li>
    </ol>
  </div>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 3</div>

  <!-- PAGE 4 -->
  <div class="page-break"></div>
  <div class="msa-text">
    <h3>4. RETURNS AND INVALID LEADS</h3>
    <ol type="a">
      <li>Buyer may submit for refund Leads it determines in its commercially reasonable discretion to be Invalid Leads, and shall support each request with the applicable Lead identifiers and the reason for the dispute.</li>
      <li>No Lead may be submitted for refund after 5:00 p.m. Eastern on the tenth (10th) day of the calendar month following the month of purchase, except where the claim arises from fraud, or from a defect in consent that Buyer could not reasonably have discovered within that period, in which case the period is ninety (90) days from delivery.</li>
      <li>Buyer shall not reject Leads on the basis of conversion rate, close rate, or downstream sales performance alone.</li>
    </ol>

    <h3>5. CONSENT RECORDS AND PROOF</h3>
    <p>Seller shall retain, for each Lead and Call, records sufficient to establish prior express written consent where Applicable Law requires it. Seller shall produce those records for any identified Lead within two (2) business days of written request. Records shall include, as applicable, screenshots of the notice and consent language on the source from which the Lead Data was collected, the source URL, the originating IP address, and the date and time stamp of collection.</p>
    <p>Seller shall retain these records for no less than five (5) years. Leads for which a valid consent record is not produced within the period stated above are non-billable and may be charged back.</p>
    <p>Buyer shall provide Seller with the accurate name and content to be inserted into the consent language, and accurate information about its calling and communication practices. Buyer shall contact Leads in accordance with the consents obtained.</p>

    <h3>6. SUB-PROVIDERS AND TRAFFIC SOURCES</h3>
    <p>Seller shall not deliver traffic sourced from a Sub-Provider that has not been disclosed to and approved by Buyer in writing. Seller is responsible for the acts and omissions of each Sub-Provider it engages as if those acts and omissions were Seller's own, and shall ensure each Sub-Provider is bound to obligations no less protective than those in this Agreement, including as to consent records and record retention.</p>

    <h3>7. DO NOT CALL AND UNSUBSCRIBE</h3>
    <p>Where a Consumer asks either Party to be placed on a do-not-call or unsubscribe list, that Party shall take commercially reasonable steps to add the Consumer to such lists as required by Applicable Law and as is standard in the industry. No such request shall be ignored. Each Party shall share such requests with the other Party as they relate to Leads or Calls transacted under this Agreement.</p>

    <h3>8. CONFIDENTIALITY</h3>
    <ol type="a">
      <li>"Confidential Information" means information marked confidential, or which by its nature or the circumstances of disclosure should reasonably be understood to be confidential or proprietary, and which is not generally available to the public, already known to the receiving Party, or independently developed without reference to the disclosing Party's information.</li>
      <li>Each Party shall keep the other's Confidential Information strictly confidential, protect it with no less than a reasonable degree of care, use it only to perform or receive services under this Agreement, and disclose it only to employees with a need to know who are informed of its confidential nature. Each Party is responsible for unauthorized disclosure by its employees.</li>
      <li>Disclosure required by law, regulation, or judicial order is permitted, provided the receiving Party first notifies the disclosing Party where not prohibited from doing so and cooperates in seeking protective treatment.</li>
      <li>On request, the receiving Party shall return or destroy the disclosing Party's Confidential Information, except for records held in routine backup or archival systems, which remain subject to this Section.</li>
      <li>The terms of this Agreement and of each IO are the Confidential Information of both Parties. Performance data relating to a Party's Leads or Calls is that Party's Confidential Information.</li>
      <li>Breach of this Section may cause irreparable harm, and the injured Party may seek equitable and injunctive relief without posting bond, in addition to any other remedy.</li>
    </ol>
  </div>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 4</div>

  <!-- PAGE 5 -->
  <div class="page-break"></div>
  <div class="msa-text">
    <h3>9. WARRANTIES</h3>
    <p><strong>9.1 Mutual</strong></p>
    <ol type="a">
      <li>Each Party has the right, power, and authority to enter into this Agreement, and this Agreement is a legal, valid, and binding obligation enforceable against it.</li>
      <li>Each Party shall comply with the terms of this Agreement and with Applicable Law.</li>
      <li>Each Party holds and shall maintain any licence, registration, or authorisation that Applicable Law requires for its performance.</li>
    </ol>
    <p><strong>9.2 Seller warranties</strong></p>
    <ol type="a">
      <li>All Leads and Calls have been lawfully collected and compiled and do not violate the rights of any third party.</li>
      <li>For lead-based engagements, all Leads carry consent language complying in all material respects with the TCPA and other Applicable Law, and that consent language obtains consent to receive autodialed calls, prerecorded telemarketing calls, and texts or SMS, to the extent the applicable campaign requires.</li>
      <li>For call engagements, related Leads were collected with consent language complying in all material respects with the TCPA and other Applicable Law, and any calls, SMS, or other technology used to generate the Call complies with Applicable Law.</li>
      <li>Leads and Calls were collected from materials and sites that do not infringe any third-party intellectual property rights and do not contain Prohibited Content.</li>
      <li>Traffic is not incentivized and does not originate from an undisclosed Sub-Provider.</li>
    </ol>

    <h3>10. DISCLAIMER OF WARRANTIES</h3>
    <p>EXCEPT FOR THE EXPRESS REPRESENTATIONS AND WARRANTIES IN THIS AGREEMENT, NEITHER PARTY MAKES ANY, AND EACH DISCLAIMS ALL, REPRESENTATIONS AND WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF FITNESS, MERCHANTABILITY, AND NON-INFRINGEMENT, AND ANY WARRANTY ARISING FROM COURSE OF PERFORMANCE, DEALING, OR TRADE USAGE. NEITHER PARTY REPRESENTS THAT OPERATION OF ITS WEBSITES OR SERVICES WILL BE UNINTERRUPTED OR ERROR-FREE.</p>

    <h3>11. LIMITATION OF LIABILITY</h3>
    <p><strong>11.1</strong> EXCEPT AS PROVIDED IN SECTION 11.2, NEITHER PARTY SHALL BE LIABLE TO THE OTHER FOR INDIRECT, SPECIAL, INCIDENTAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF GOODWILL, LOST PROFITS, WORK STOPPAGE, OR EQUIPMENT FAILURE, EVEN IF ADVISED OF THE POSSIBILITY. EACH PARTY'S AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE GREATER OF (i) THE AMOUNTS PAID OR PAYABLE BETWEEN THE PARTIES UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (ii) $50,000.</p>
    <p><strong>11.2 Exclusions.</strong> The limitations in Section 11.1 do not apply to: a Party's indemnification obligations under Section 12; breach of Section 8 (Confidentiality); a Party's violation of Applicable Law; fraud, gross negligence, or willful misconduct; or amounts owed for Leads or Calls delivered and accepted.</p>

    <h3>12. INDEMNIFICATION</h3>
    <p>Each Party shall indemnify, defend, and hold harmless the other Party, its affiliates, and their respective officers, directors, employees, and agents from any third-party claims, demands, proceedings, suits, actions, liabilities, losses, damages, fines, penalties, judgments, settlements, and reasonable expenses (including attorneys' and accountants' fees) to the extent arising from: (i) the indemnifying Party's intentional, negligent, or other conduct, or that of its employees, agents, or Sub-Providers; (ii) breach of any representation, warranty, or covenant of the indemnifying Party; (iii) the indemnifying Party's violation of Applicable Law; or (iv) the other Party's use of the indemnifying Party's services as contemplated by this Agreement.</p>
    <p>The indemnified Party shall promptly notify the indemnifying Party of any claim, and shall not settle a claim without the indemnifying Party's consent, not to be unreasonably withheld. Delay in notice relieves the indemnifying Party only to the extent it is materially prejudiced.</p>
  </div>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 5</div>

  <!-- PAGE 6 -->
  <div class="page-break"></div>
  <div class="msa-text">
    <h3>13. INSURANCE</h3>
    <p>While this Agreement is in effect and for one (1) year thereafter, each Party shall maintain, at its own expense, insurance written by carriers with an A.M. Best rating of at least A-, in the following minimum amounts: commercial general liability of $1,000,000 per occurrence and $2,000,000 in the aggregate; errors and omissions (professional liability) of $1,000,000 per occurrence and in the aggregate; and cyber liability of $1,000,000. Each Party shall furnish certificates of insurance on request.</p>

    <h3>14. TERM AND TERMINATION</h3>
    <ol type="a">
      <li>This Agreement runs for twelve (12) months from the execution date and renews automatically for successive twelve (12) month terms unless either Party gives notice of non-renewal at least thirty (30) days before the end of the then-current term.</li>
      <li>Either Party may terminate this Agreement or any IO on ten (10) business days written notice.</li>
      <li>Either Party may terminate immediately on material breach by the other Party that remains uncured five (5) business days after written notice, and immediately without cure period where the breach involves Applicable Law, consent, or fraud.</li>
      <li>Amounts accrued before termination remain payable. Sections 5, 8, 11, 12, and this Section survive termination.</li>
    </ol>

    <h3>15. NOTICES</h3>
    <p>Routine notices for day-to-day management may be given by email or such other method as the Parties agree. Non-routine notices — including termination, default, indemnification demands, and assignment — shall be in writing, are effective on receipt or refusal of delivery, and shall be sent by personal delivery, overnight courier, or certified mail, return receipt requested, with a copy by email.</p>
    <p>Non-routine notices to Grovlabs shall be sent to ________________________, with a copy by email to uj@grovlabs.com. Non-routine notices to Counterparty shall be sent to ${partner.address_line1 || '________________________'}, with a copy by email to ${partner.contact_email}.</p>

    <h3>16. MISCELLANEOUS</h3>
    <p><strong>16.1 No waiver.</strong> No waiver, express or implied, of any provision or breach constitutes a continuing waiver of that or any other provision.</p>
    <p><strong>16.2 Governing law and venue.</strong> This Agreement is governed by the laws of Delaware, without regard to conflict-of-law rules. The Parties submit to the exclusive jurisdiction of the courts of Delaware. The United Nations Convention on Contracts for the International Sale of Goods does not apply.</p>
    <p><strong>16.3 Assignment.</strong> Neither Party may assign this Agreement or any IO without the other Party's prior written consent, not to be unreasonably withheld, except to an affiliate or to a successor in a merger or sale of substantially all assets, provided the assignee assumes the obligations in writing.</p>
    <p><strong>16.4 Entire agreement and amendment.</strong> This Agreement, together with all IOs and addenda, is the entire agreement on this subject and supersedes prior negotiations and understandings. Amendment requires a writing signed by both Parties, except that lead type and pricing may be modified by email under Section 3(d).</p>
    <p><strong>16.5 Public statements.</strong> Neither Party shall issue a public statement or press release referencing the other Party without prior written consent.</p>
    <p><strong>16.6 Construction.</strong> This Agreement is deemed drafted by both Parties, and no rule construing ambiguities against the drafter applies. "Include" and its variants mean without limitation; "days" means calendar days unless stated otherwise.</p>
  </div>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 6</div>

  <!-- PAGE 7 -->
  <div class="page-break"></div>
  <div class="msa-text">
    <p><strong>16.7 Severability.</strong> An invalid or unenforceable provision shall be revised to reflect the Parties' intent to the maximum extent permitted, or severed, and the remainder continues in effect.</p>
    <p><strong>16.8 Relationship.</strong> The Parties are independent contractors. Nothing creates a partnership, joint venture, agency, or employment relationship, and neither Party may make representations on the other's behalf.</p>
    <p><strong>16.9 No personal guarantee.</strong> Obligations under this Agreement are corporate obligations only. No officer, director, employee, or owner signing on behalf of a Party gives a personal guarantee unless that individual signs a separate express guarantee.</p>
    <p><strong>16.10 Force majeure.</strong> Neither Party is in breach for delay caused by an event beyond its reasonable control, provided it promptly notifies the other and uses reasonable efforts to mitigate. This does not excuse payment already accrued. If the event continues more than thirty (30) days, either Party may terminate the affected IO.</p>
    <p><strong>16.11 Signatory authorisation.</strong> Each individual signing represents that he or she is duly authorised to execute this Agreement on behalf of that Party.</p>
    <p><strong>16.12 Counterparts and e-signatures.</strong> This Agreement and any IO may be signed in counterparts and by electronic signature, each deemed an original and together one instrument.</p>

    <p style="margin-top: 40px;"><strong>IN WITNESS WHEREOF</strong>, the Parties have executed this Agreement as of the dates below.</p>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <h4>Grovlabs</h4>
      ${io.counter_signed_at ? `
        <div class="sig-filled">${io.counter_sign_name || ''}</div>
        <div class="sig-label">Signature</div>
        <div class="sig-filled">${io.counter_sign_name || ''}</div>
        <div class="sig-label">Name</div>
        <div class="sig-filled">${io.counter_sign_title || ''}</div>
        <div class="sig-label">Title</div>
        <div class="sig-filled">${new Date(io.counter_signed_at).toLocaleDateString()}</div>
        <div class="sig-label">Date</div>
      ` : `
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
        <div class="sig-line"></div>
        <div class="sig-label">Name</div>
        <div class="sig-line"></div>
        <div class="sig-label">Title</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
      `}
    </div>
    <div class="sig-block">
      <h4>COUNTERPARTY</h4>
      ${io.network_signed_at ? `
        <div class="sig-filled">${io.network_sign_name || ''}</div>
        <div class="sig-label">Signature</div>
        <div class="sig-filled">${io.network_sign_name || ''}</div>
        <div class="sig-label">Name</div>
        <div class="sig-filled">${io.network_sign_title || ''}</div>
        <div class="sig-label">Title</div>
        <div class="sig-filled">${new Date(io.network_signed_at).toLocaleDateString()}</div>
        <div class="sig-label">Date</div>
      ` : `
        <div class="sig-line"></div>
        <div class="sig-label">Signature</div>
        <div class="sig-line"></div>
        <div class="sig-label">Name</div>
        <div class="sig-line"></div>
        <div class="sig-label">Title</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date</div>
      `}
    </div>
  </div>

  <div class="page-footer">Grovlabs — Master Services Agreement & Insertion Order &nbsp;&nbsp;&nbsp; Page 7</div>

</body>
</html>
    `.trim();
  }

  private buildIOHtml(io: any): string {
    const partner = io.network;
    const buyerChecked = io.grovlabs_role === 'buyer' ? '☑' : '☐';
    const sellerChecked = io.grovlabs_role === 'seller' ? '☑' : '☐';
    const statusClass = io.status === 'active' ? 'status-active' : 'status-pending';
    const statusLabel = io.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>N2N IO - ${io.io_number}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; }
    h1 { font-size: 28px; margin-bottom: 5px; }
    h2 { font-size: 20px; color: #666; font-weight: normal; margin-top: 0; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #050505; padding-bottom: 20px; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
    .party { padding: 20px; background: #f8f8f8; border-radius: 8px; }
    .party h3 { margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; color: #666; }
    .party-field { margin-bottom: 10px; }
    .party-field label { display: block; font-size: 11px; color: #999; text-transform: uppercase; }
    .party-field span { font-size: 14px; }
    .details { margin: 30px 0; }
    .details h3 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .detail-item { padding: 10px; background: #fafafa; border-radius: 4px; }
    .detail-item label { display: block; font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 3px; }
    .detail-item span { font-size: 14px; font-weight: 500; }
    .role-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .role-buyer { background: #e3f2fd; color: #1565c0; }
    .role-seller { background: #e8f5e9; color: #2e7d32; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; }
    .status-active { background: #c8e6c9; color: #2e7d32; }
    .status-pending { background: #fff3e0; color: #ef6c00; }
    .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #050505; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #333; }
    @media print { .print-btn { display: none; } }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 2px solid #050505; }
    .signature-block h4 { margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; }
    .sig-line { border-bottom: 1px solid #333; height: 30px; margin-bottom: 5px; }
    .sig-label { font-size: 11px; color: #666; margin-bottom: 15px; }
    .signed-info { background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 10px; }
    .signed-info p { margin: 5px 0; font-size: 13px; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <div class="header">
    <h1>INSERTION ORDER</h1>
    <h2>Grovlabs • Campaign Cover Sheet</h2>
    <p style="font-size: 14px; color: #666;">IO Number: ${io.io_number}</p>
    <span class="status-badge ${statusClass}">${statusLabel}</span>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Grovlabs</h3>
      <div class="party-field"><label>Legal Name</label><span>Grovlabs</span></div>
      <div class="party-field"><label>Contact Name</label><span>Usman Javed</span></div>
      <div class="party-field"><label>Phone</label><span>+1 (754) 344-0773</span></div>
      <div class="party-field"><label>Email</label><span>uj@grovlabs.com</span></div>
    </div>
    <div class="party">
      <h3>Counterparty</h3>
      <div class="party-field"><label>Legal Name</label><span>${partner.legal_name}</span></div>
      <div class="party-field"><label>Organized In</label><span>${partner.organized_in || '—'}</span></div>
      <div class="party-field"><label>Contact Name</label><span>${partner.contact_name}</span></div>
      <div class="party-field"><label>Phone</label><span>${partner.contact_phone}</span></div>
      <div class="party-field"><label>Email</label><span>${partner.contact_email}</span></div>
      <div class="party-field"><label>Address</label><span>${partner.address_line1 || '—'}</span></div>
    </div>
  </div>

  <div class="details">
    <h3>Campaign Details</h3>
    <p style="margin-bottom: 20px;">
      Grovlabs acts as:
      <span class="role-badge ${io.grovlabs_role === 'buyer' ? 'role-buyer' : 'role-seller'}">
        ${io.grovlabs_role.toUpperCase()}
      </span>
    </p>
    <div class="detail-grid">
      <div class="detail-item"><label>Industry / Vertical</label><span>${io.industry || '—'}</span></div>
      <div class="detail-item"><label>Lead Type</label><span>${io.lead_type || '—'}</span></div>
      <div class="detail-item"><label>Geo</label><span>${io.geo || '—'}</span></div>
      <div class="detail-item"><label>Daily Cap</label><span>${io.daily_cap || '—'}</span></div>
      <div class="detail-item"><label>Concurrency</label><span>${io.concurrency || '—'}</span></div>
      <div class="detail-item"><label>Payment Terms</label><span>${io.payment_terms || '—'}</span></div>
      <div class="detail-item"><label>Start Date</label><span>${io.start_date ? new Date(io.start_date).toLocaleDateString() : '—'}</span></div>
      <div class="detail-item"><label>End Date</label><span>${io.end_date ? new Date(io.end_date).toLocaleDateString() : '—'}</span></div>
      <div class="detail-item"><label>Compensation Type</label><span>${io.compensation_type || '—'}</span></div>
      <div class="detail-item"><label>Compensation Amount</label><span>${io.compensation_amount ? '$' + Number(io.compensation_amount).toFixed(2) : '—'}</span></div>
      <div class="detail-item"><label>Minimum Duration</label><span>${io.minimum_duration ? io.minimum_duration + 's' : '—'}</span></div>
      <div class="detail-item"><label>Hours of Operation</label><span>${io.hours_of_operation || '—'}</span></div>
      <div class="detail-item"><label>Payout Threshold</label><span>${io.payout_threshold ? '$' + Number(io.payout_threshold).toFixed(2) : '—'}</span></div>
      <div class="detail-item"><label>Other Terms</label><span>${io.other_terms || '—'}</span></div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature-block">
      <h4>Grovlabs</h4>
      ${io.counter_signed_at ? `
        <div class="signed-info">
          <p><strong>Signed by:</strong> ${io.counter_sign_name}</p>
          <p><strong>Title:</strong> ${io.counter_sign_title}</p>
          <p><strong>Date:</strong> ${new Date(io.counter_signed_at).toLocaleDateString()}</p>
        </div>
      ` : `
        <div class="sig-line"></div><div class="sig-label">Signature</div>
        <div class="sig-line"></div><div class="sig-label">Name</div>
        <div class="sig-line"></div><div class="sig-label">Title</div>
        <div class="sig-line"></div><div class="sig-label">Date</div>
      `}
    </div>
    <div class="signature-block">
      <h4>Counterparty</h4>
      ${io.network_signed_at ? `
        <div class="signed-info">
          <p><strong>Signed by:</strong> ${io.network_sign_name}</p>
          <p><strong>Title:</strong> ${io.network_sign_title}</p>
          <p><strong>Date:</strong> ${new Date(io.network_signed_at).toLocaleDateString()}</p>
        </div>
      ` : `
        <div class="sig-line"></div><div class="sig-label">Signature</div>
        <div class="sig-line"></div><div class="sig-label">Name</div>
        <div class="sig-line"></div><div class="sig-label">Title</div>
        <div class="sig-line"></div><div class="sig-label">Date</div>
      `}
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
