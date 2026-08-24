import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';

export type FaultSide = 'buyer' | 'vendor' | 'external' | 'neutral';

export interface CallReview {
  trackdrive_call_id: string;
  vendor_name: string;
  vendor_td_id: string | null;
  buyer_name: string | null;
  buyer_td_id: string | null;
  campaign_name: string | null;
  caller_number: string | null;
  caller_city: string | null;
  caller_state: string | null;
  number_called: string | null;
  duration: number;
  call_status: string | null;
  fault_side: FaultSide;
  outcome_reason: string;
  what_happened: string;
  fix_suggestion: string | null;
  recording_url: string | null;
  raw_ai_response: any;
}

@Injectable()
export class NonConversionQaService {
  private readonly logger = new Logger(NonConversionQaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly td: TrackDriveService,
  ) {}

  /** PST date helpers */
  private pstDateString(d: Date = new Date()): string {
    // en-CA gives YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  /** Build ISO range (with -07:00 offset) for a given PST date string YYYY-MM-DD */
  private pstRange(dateStr: string): { from: string; to: string } {
    return {
      from: `${dateStr}T00:00:00-07:00`,
      to: `${dateStr}T23:59:59-07:00`,
    };
  }

  /** Fetch all non-converted calls (that have a recording) for a PST date. */
  async fetchNonConvertedCalls(dateStr: string): Promise<any[]> {
    const { from, to } = this.pstRange(dateStr);
    const all = await this.td.fetchAllCallsForRange(from, to, 100);
    const nonConverted = all.filter(
      (c) => String(c.buyer_converted) !== 'Converted' && !!c.recording_url,
    );
    this.logger.log(
      `Date ${dateStr}: ${all.length} total calls, ${nonConverted.length} non-converted with recording`,
    );
    return nonConverted;
  }

  /** Download a recording following redirects (TrackDrive -> signed S3). */
  private async downloadRecording(url: string): Promise<Buffer> {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (BSBW-QA-Bot)' },
    });
    return Buffer.from(resp.data);
  }

  /** Analyze one non-converted call recording with RTB-aware classification. */
  async reviewCall(call: any): Promise<CallReview> {
    const vendorName = call.traffic_source || 'Unknown Vendor';
    const buyerName = call.buyer || null;
    const campaignName = call.offer || null;
    const duration = Number(call.total_duration) || 0;
    const answeredDuration = Number(call.answered_duration) || 0;
    const agentDuration = Number(call.agent_duration) || 0;
    const callerState = call['token-state'] || call['token-geo_state'] || null;
    const callerNumber = call.caller_number || null;
    const callerCity = call.caller_city || null;
    const numberCalled = call.number_called || null;
    const status = call.status || null;
    const disposition = call.disposition_name || null;

    const apiKey = this.config.get<string>('ABACUSAI_API_KEY', '');
    const recordingUrl = call.recording_url as string;

    const audio = await this.downloadRecording(recordingUrl);
    const b64 = audio.toString('base64');

    const prompt = this.buildPrompt({
      vendorName,
      buyerName,
      campaignName,
      duration,
      answeredDuration,
      agentDuration,
      status,
      disposition,
      callerState,
    });

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'call.mp3',
                  file_data: `data:audio/mpeg;base64,${b64}`,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await response.json()) as any;
    let content = data?.choices?.[0]?.message?.content?.trim() || '';
    if (content.startsWith('```')) {
      content = content.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    }
    const parsed = JSON.parse(content);

    const faultSide = this.normalizeFault(parsed.fault_side);

    return {
      trackdrive_call_id: String(call.id),
      vendor_name: vendorName,
      vendor_td_id: call.traffic_source_id ? String(call.traffic_source_id) : null,
      buyer_name: buyerName,
      buyer_td_id: call.buyer_id ? String(call.buyer_id) : null,
      campaign_name: campaignName,
      caller_number: callerNumber,
      caller_city: callerCity,
      caller_state: callerState,
      number_called: numberCalled,
      duration,
      call_status: status,
      fault_side: faultSide,
      outcome_reason: parsed.outcome_reason || 'other',
      what_happened: parsed.what_happened || '',
      fix_suggestion: parsed.fix_suggestion || null,
      recording_url: recordingUrl,
      raw_ai_response: parsed,
    };
  }

  private normalizeFault(v: any): FaultSide {
    const s = String(v || '').toLowerCase();
    if (s.includes('buyer')) return 'buyer';
    if (s.includes('vendor')) return 'vendor';
    if (s.includes('external')) return 'external';
    return 'neutral';
  }

  private buildPrompt(ctx: {
    vendorName: string;
    buyerName: string | null;
    campaignName: string | null;
    duration: number;
    answeredDuration: number;
    agentDuration: number;
    status: string | null;
    disposition: string | null;
    callerState: string | null;
  }): string {
    return `You are a QA analyst for The Broken Wood Inc, a company that brokers INBOUND phone calls using a REAL-TIME BIDDING (RTB) model.

HOW THE RTB MODEL WORKS (critical for fault attribution):
1. A traffic VENDOR generates the inbound call and pings BSBW with the caller/lead info (including the caller's geography/state).
2. BSBW relays the ping to the BUYER network. Buyers who WANT the call BID on it. Buyers see the ping data (including caller state) BEFORE bidding.
3. The vendor then sends the live call to the winning buyer.
4. The call "converts" only if it stays connected past a billable time threshold with the buyer.

BECAUSE THE BUYER BID ON THIS CALL BEFORE RECEIVING IT, any failure that happens on the BUYER's side is BUYER NEGLIGENCE, not the vendor's fault. A buyer should never bid on a call it cannot actually take.

THIS CALL DID NOT CONVERT. Listen to the recording and determine what happened and WHO is at fault.

FAULT ATTRIBUTION RULES:
- fault_side = "buyer"  -> The buyer received the call (they bid and won) but then FAILED it. Examples: dead air / no agent ever spoke, an IVR/recording saying "no carriers available" or "try again later", the buyer's rep rejected the caller live (e.g. "we don't service your area / zip") even though they bid knowing the caller's location, the buyer put the caller on endless hold until they dropped, the buyer hung up, or the buyer's line just rang with no answer.
- fault_side = "vendor" -> The problem is the LEAD QUALITY the vendor sent. Examples: the caller hung up almost immediately before any real interaction, the caller is clearly not interested or not qualified or has the wrong intent, bad CALLER-side audio/no one really there, obvious spam/robocall/invalid, a duplicate/repeat caller, or the caller says they never requested this.
- fault_side = "external" -> Neither party is clearly at fault (network/carrier glitch, genuinely ambiguous, caller just wanted info and politely ended).
- fault_side = "neutral" -> Legitimate non-conversion with no negligence and no clear improvement (e.g., a short genuine call that simply did not reach billable duration).

IMPORTANT NUANCES:
- An automated "no carriers available" / "no agents available" message is almost always the BUYER's fault, because the buyer bid on the call and then had nobody to take it. Do NOT blame the vendor for this.
- A buyer rejecting a caller live for being out of their service area is the BUYER's fault, because the buyer saw the caller's state/geo in the ping and chose to bid anyway.
- Only attribute to the vendor when the CALLER themselves is the problem (hung up instantly, not interested, junk lead, bad audio on the caller side, wrong intent).

CALL METADATA (for your reference, verify against what you actually hear):
- Vendor (traffic source): ${ctx.vendorName}
- Buyer that received the call: ${ctx.buyerName || 'Unknown'}
- Campaign: ${ctx.campaignName || 'Unknown'}
- Total duration: ${ctx.duration}s | Answered duration: ${ctx.answeredDuration}s | Agent talk duration: ${ctx.agentDuration}s
- TrackDrive status: ${ctx.status || 'unknown'} | Disposition: ${ctx.disposition || 'none'} | Caller state: ${ctx.callerState || 'unknown'}

Respond with RAW JSON ONLY (no markdown, no code blocks) in this exact shape:
{
  "outcome_reason": "<short snake_case reason, one of: dead_air_no_agent, no_carrier_available, buyer_rejected_out_of_area, buyer_rejected_live, buyer_hung_up, excessive_hold_dropped, ivr_no_live_agent, caller_hung_up_early, caller_not_interested, caller_not_qualified, bad_caller_audio, language_barrier, duplicate_repeat_caller, spam_invalid, short_no_billable_duration, other>",
  "fault_side": "<buyer|vendor|external|neutral>",
  "what_happened": "<2-3 sentence plain-English description of what actually occurred on the call>",
  "fix_suggestion": "<one concrete, specific suggestion for the at-fault party to prevent this; if neutral/external, give a brief note>"
}`;
  }

  /** Process an array of calls with bounded concurrency. */
  async reviewCallsBatched(
    calls: any[],
    concurrency = 5,
  ): Promise<{ reviews: CallReview[]; failures: { id: string; error: string }[] }> {
    const reviews: CallReview[] = [];
    const failures: { id: string; error: string }[] = [];
    let idx = 0;

    const worker = async () => {
      while (idx < calls.length) {
        const current = calls[idx++];
        try {
          const review = await this.reviewCall(current);
          reviews.push(review);
        } catch (err: any) {
          this.logger.warn(`Review failed for call ${current?.id}: ${err.message}`);
          failures.push({ id: String(current?.id), error: err.message });
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, calls.length) }, () => worker());
    await Promise.all(workers);
    return { reviews, failures };
  }

  /** Persist reviews to DB (idempotent per call+date). */
  async storeReviews(reviews: CallReview[], reviewDate: string): Promise<number> {
    let stored = 0;
    for (const r of reviews) {
      try {
        await this.prisma.non_conversion_review.upsert({
          where: {
            trackdrive_call_id_review_date: {
              trackdrive_call_id: r.trackdrive_call_id,
              review_date: reviewDate,
            },
          },
          update: {
            vendor_name: r.vendor_name,
            vendor_td_id: r.vendor_td_id,
            buyer_name: r.buyer_name,
            buyer_td_id: r.buyer_td_id,
            campaign_name: r.campaign_name,
            caller_number: r.caller_number,
            caller_city: r.caller_city,
            caller_state: r.caller_state,
            number_called: r.number_called,
            duration: r.duration,
            call_status: r.call_status,
            fault_side: r.fault_side,
            outcome_reason: r.outcome_reason,
            what_happened: r.what_happened,
            fix_suggestion: r.fix_suggestion,
            recording_url: r.recording_url,
            raw_ai_response: r.raw_ai_response,
          },
          create: {
            trackdrive_call_id: r.trackdrive_call_id,
            review_date: reviewDate,
            vendor_name: r.vendor_name,
            vendor_td_id: r.vendor_td_id,
            buyer_name: r.buyer_name,
            buyer_td_id: r.buyer_td_id,
            campaign_name: r.campaign_name,
            caller_number: r.caller_number,
            caller_city: r.caller_city,
            caller_state: r.caller_state,
            number_called: r.number_called,
            duration: r.duration,
            call_status: r.call_status,
            fault_side: r.fault_side,
            outcome_reason: r.outcome_reason,
            what_happened: r.what_happened,
            fix_suggestion: r.fix_suggestion,
            recording_url: r.recording_url,
            raw_ai_response: r.raw_ai_response,
          },
        });
        stored++;
      } catch (err: any) {
        this.logger.warn(`Failed to store review for call ${r.trackdrive_call_id}: ${err.message}`);
      }
    }
    return stored;
  }

  /** Fetch stored reviews for a date. */
  async getReviews(reviewDate: string) {
    return this.prisma.non_conversion_review.findMany({
      where: { review_date: reviewDate },
      orderBy: [{ fault_side: 'asc' }, { vendor_name: 'asc' }],
    });
  }

  /** Resolve the target date string (defaults to today PST). */
  resolveDate(input?: string): string {
    if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    if (input === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return this.pstDateString(d);
    }
    return this.pstDateString();
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------

  private prettyReason(reason: string): string {
    return String(reason || 'other')
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /** Aggregate reviews by a key, counting outcome reasons within each group. */
  private aggregateBy(
    reviews: CallReview[],
    keyFn: (r: CallReview) => string,
  ): {
    key: string;
    total: number;
    reasons: { reason: string; count: number }[];
    examples: CallReview[];
  }[] {
    const groups = new Map<string, CallReview[]>();
    for (const r of reviews) {
      const k = keyFn(r) || 'Unknown';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const out = Array.from(groups.entries()).map(([key, rs]) => {
      const reasonCounts = new Map<string, number>();
      for (const r of rs) {
        const reason = r.outcome_reason || 'other';
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      }
      const reasons = Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
      return { key, total: rs.length, reasons, examples: rs.slice(0, 3) };
    });
    return out.sort((a, b) => b.total - a.total);
  }

  private escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Build the two-sided HTML email report. */
  buildEmailHtml(reviews: CallReview[], dateStr: string, meta?: { totalNonConverted?: number; reviewed?: number; failures?: number }): string {
    const buyerReviews = reviews.filter((r) => r.fault_side === 'buyer');
    const vendorReviews = reviews.filter((r) => r.fault_side === 'vendor');
    const externalReviews = reviews.filter((r) => r.fault_side === 'external');
    const neutralReviews = reviews.filter((r) => r.fault_side === 'neutral');

    const buyerAgg = this.aggregateBy(buyerReviews, (r) => r.buyer_name || 'Unknown Buyer');
    const vendorAgg = this.aggregateBy(vendorReviews, (r) => r.vendor_name || 'Unknown Vendor');

    const card = (label: string, value: string | number, color: string) => `
      <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:26px;font-weight:700;color:${color};line-height:1;">${value}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px;text-transform:uppercase;letter-spacing:.04em;">${label}</div>
      </div>`;

    const renderGroup = (
      title: string,
      subtitle: string,
      agg: { key: string; total: number; reasons: { reason: string; count: number }[]; examples: CallReview[] }[],
      accent: string,
    ) => {
      if (agg.length === 0) {
        return `<div style="margin-top:28px;">
          <h2 style="font-size:18px;color:#111827;margin:0 0 4px;">${title}</h2>
          <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">${subtitle}</p>
          <p style="font-size:14px;color:#6b7280;">No calls attributed to this side today.</p>
        </div>`;
      }
      const rows = agg
        .map((g) => {
          const reasonList = g.reasons
            .map(
              (r) =>
                `<span style="display:inline-block;background:#f3f4f6;border-radius:12px;padding:3px 10px;margin:2px 4px 2px 0;font-size:12px;color:#374151;">${this.escapeHtml(
                  this.prettyReason(r.reason),
                )}: <b>${r.count}</b></span>`,
            )
            .join('');
          const example = g.examples[0];
          const exampleLine = example
            ? `<div style="font-size:12px;color:#6b7280;margin-top:8px;font-style:italic;">e.g. ${this.escapeHtml(
                (example.what_happened || '').slice(0, 180),
              )}</div>`
            : '';
          return `<tr>
            <td style="padding:14px 12px;border-bottom:1px solid #eef0f3;vertical-align:top;">
              <div style="font-weight:600;color:#111827;font-size:15px;">${this.escapeHtml(g.key)}</div>
              <div style="margin-top:6px;">${reasonList}</div>
              ${exampleLine}
            </td>
            <td style="padding:14px 12px;border-bottom:1px solid #eef0f3;text-align:right;vertical-align:top;">
              <span style="display:inline-block;background:${accent};color:#fff;border-radius:8px;padding:6px 12px;font-weight:700;font-size:15px;">${g.total}</span>
            </td>
          </tr>`;
        })
        .join('');
      return `<div style="margin-top:28px;">
        <h2 style="font-size:18px;color:#111827;margin:0 0 4px;">${title}</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">${subtitle}</p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="text-align:left;padding:10px 12px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">${title.includes('Buyer') ? 'Buyer' : 'Vendor'} &amp; Reasons</th>
              <th style="text-align:right;padding:10px 12px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Calls</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    };

    const total = reviews.length;
    const metaLine = meta
      ? `<p style="font-size:12px;color:#9ca3af;margin:6px 0 0;">${meta.totalNonConverted ?? total} non-converted calls with recordings · ${meta.reviewed ?? total} reviewed${
          meta.failures ? ` · ${meta.failures} could not be analyzed` : ''
        }</p>`
      : '';

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:12px;padding:24px;color:#fff;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">The Broken Wood Inc · Non-Conversion QA</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">Daily Non-Conversion Review</div>
      <div style="font-size:14px;opacity:.85;margin-top:2px;">${dateStr}</div>
      ${metaLine.replace('#9ca3af', '#cbd5e1')}
    </div>

    <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
      ${card('Reviewed', total, '#111827')}
      ${card('Buyer Fault', buyerReviews.length, '#dc2626')}
      ${card('Vendor Fault', vendorReviews.length, '#d97706')}
      ${card('External/Neutral', externalReviews.length + neutralReviews.length, '#6b7280')}
    </div>

    ${renderGroup(
      'Buyer-Side Report (Buyer Negligence)',
      'Calls the buyer bid on and won, then failed. The buyer saw the caller data before bidding.',
      buyerAgg,
      '#dc2626',
    )}

    ${renderGroup(
      'Vendor-Side Report (Lead Quality)',
      'Calls that failed because of the lead/caller the vendor sent.',
      vendorAgg,
      '#d97706',
    )}

    <p style="font-size:12px;color:#9ca3af;margin-top:28px;text-align:center;">
      Automated report from the The Broken Wood QA Agent. Reply to this email to reach Sammy.
    </p>
  </div>
</body>
</html>`;
  }

  /** Build a concise, clean Telegram summary (professional, minimal emojis). */
  buildTelegramSummary(reviews: CallReview[], dateStr: string): string {
    const buyerReviews = reviews.filter((r) => r.fault_side === 'buyer');
    const vendorReviews = reviews.filter((r) => r.fault_side === 'vendor');
    const otherCount = reviews.length - buyerReviews.length - vendorReviews.length;

    const buyerAgg = this.aggregateBy(buyerReviews, (r) => r.buyer_name || 'Unknown Buyer');
    const vendorAgg = this.aggregateBy(vendorReviews, (r) => r.vendor_name || 'Unknown Vendor');

    const lines: string[] = [];
    lines.push(`<b>Non-Conversion QA — ${this.escapeHtml(dateStr)}</b>`);
    lines.push('');
    lines.push(
      `Reviewed <b>${reviews.length}</b> non-converted calls — Buyer fault: <b>${buyerReviews.length}</b>, Vendor fault: <b>${vendorReviews.length}</b>, Other: <b>${otherCount}</b>`,
    );

    if (buyerAgg.length) {
      lines.push('');
      lines.push('<b>Buyer-side (buyer negligence)</b>');
      for (const g of buyerAgg.slice(0, 6)) {
        const top = g.reasons.slice(0, 2).map((r) => `${this.prettyReason(r.reason)} ${r.count}`).join(', ');
        lines.push(`• ${this.escapeHtml(g.key)}: <b>${g.total}</b> (${this.escapeHtml(top)})`);
      }
    }

    if (vendorAgg.length) {
      lines.push('');
      lines.push('<b>Vendor-side (lead quality)</b>');
      for (const g of vendorAgg.slice(0, 6)) {
        const top = g.reasons.slice(0, 2).map((r) => `${this.prettyReason(r.reason)} ${r.count}`).join(', ');
        lines.push(`• ${this.escapeHtml(g.key)}: <b>${g.total}</b> (${this.escapeHtml(top)})`);
      }
    }

    lines.push('');
    lines.push('Full breakdown sent to your email.');
    return lines.join('\n');
  }

  /** Send the HTML report via the notification email API. */
  private async sendEmail(subject: string, html: string, recipients: string[]): Promise<void> {
    const hostname = (() => {
      try {
        return new URL(process.env.APP_ORIGIN || 'https://bsbw-qa-agent.abacusai.app').hostname;
      } catch {
        return 'bsbw-qa-agent.abacusai.app';
      }
    })();

    for (const recipient of recipients) {
      try {
        const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_NONCONVERSION_QA_REPORT,
            subject,
            body: html,
            is_html: true,
            recipient_email: recipient,
            sender_email: `noreply@${hostname}`,
            sender_alias: 'The Broken Wood Inc',
            reply_to: 'uj@grovlabs.com',
          }),
        });
        const result = (await response.json()) as any;
        if (!result.success && !result.notification_disabled) {
          this.logger.error(`Non-conversion report email failed for ${recipient}: ${result.message}`);
        } else {
          this.logger.log(`Non-conversion report email sent to ${recipient}`);
        }
      } catch (err: any) {
        this.logger.error(`Email error for ${recipient}: ${err.message}`);
      }
    }
  }

  /** Send the Telegram summary. */
  private async sendTelegram(text: string): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) {
      this.logger.warn('Telegram not configured; skipping summary');
      return;
    }
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      this.logger.log('Non-conversion Telegram summary sent');
    } catch (err: any) {
      this.logger.error(`Telegram summary failed: ${err.message}`);
    }
  }

  /**
   * Full orchestration: fetch non-converted calls -> review -> store -> report.
   * Designed to be called in the background (fire-and-forget) from the controller.
   */
  async runDailyReview(
    dateStr: string,
    options?: { cap?: number; notify?: boolean },
  ): Promise<{
    date: string;
    totalNonConverted: number;
    reviewed: number;
    failures: number;
    stored: number;
    buyerFault: number;
    vendorFault: number;
  }> {
    const cap = options?.cap ?? 300;
    const notify = options?.notify ?? true;

    this.logger.log(`Starting non-conversion review for ${dateStr} (cap ${cap})`);
    const nonConverted = await this.fetchNonConvertedCalls(dateStr);
    const totalNonConverted = nonConverted.length;
    const toReview = nonConverted.slice(0, cap);

    const { reviews, failures } = await this.reviewCallsBatched(toReview, 5);
    const stored = await this.storeReviews(reviews, dateStr);

    const buyerFault = reviews.filter((r) => r.fault_side === 'buyer').length;
    const vendorFault = reviews.filter((r) => r.fault_side === 'vendor').length;

    if (notify) {
      const subject = `Non-Conversion QA — ${dateStr}: ${reviews.length} reviewed (Buyer ${buyerFault}, Vendor ${vendorFault})`;
      const html = this.buildEmailHtml(reviews, dateStr, {
        totalNonConverted,
        reviewed: reviews.length,
        failures: failures.length,
      });
      await this.sendEmail(subject, html, ['uj@grovlabs.com']);
      await this.sendTelegram(this.buildTelegramSummary(reviews, dateStr));
    }

    this.logger.log(
      `Non-conversion review for ${dateStr} complete: reviewed ${reviews.length}, failures ${failures.length}, stored ${stored}`,
    );

    return {
      date: dateStr,
      totalNonConverted,
      reviewed: reviews.length,
      failures: failures.length,
      stored,
      buyerFault,
      vendorFault,
    };
  }
}
