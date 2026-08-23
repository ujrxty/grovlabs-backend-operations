import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';

/**
 * The lead's outcome on a billable (connected + converted) call, focused on
 * whether the rep issued an insurance quote and how far the lead went with it.
 */
export type SalesOutcome =
  | 'sale_completed'
  | 'quote_accepted_deferred'
  | 'quote_pending_approval'
  | 'quote_received_reviewing'
  | 'quote_declined'
  | 'no_quote_issued';

export type FollowThrough = 'high' | 'medium' | 'low' | 'none';

export interface SalesReview {
  trackdrive_call_id: string;
  vendor_name: string;
  vendor_td_id: string | null;
  buyer_name: string | null;
  buyer_td_id: string | null;
  campaign_name: string | null;
  campaign_category: string | null;
  caller_number: string | null;
  caller_city: string | null;
  caller_state: string | null;
  number_called: string | null;
  duration: number;
  call_status: string | null;
  revenue: number | null;
  quote_issued: boolean;
  outcome_category: SalesOutcome;
  follow_through_likelihood: FollowThrough;
  quote_type: string | null;
  quote_amount: string | null;
  payment_mentioned: boolean;
  what_happened: string;
  key_quote: string | null;
  caller_response: string | null;
  recording_url: string | null;
  raw_ai_response: any;
}

@Injectable()
export class SalesQaService {
  private readonly logger = new Logger(SalesQaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly td: TrackDriveService,
  ) {}

  // ---------------------------------------------------------------------------
  // Date helpers (PST / America/Phoenix)
  // ---------------------------------------------------------------------------
  private pstDateString(d: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Phoenix',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  private pstRange(dateStr: string): { from: string; to: string } {
    return {
      from: `${dateStr}T00:00:00-07:00`,
      to: `${dateStr}T23:59:59-07:00`,
    };
  }

  resolveDate(input?: string): string {
    if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    if (input === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return this.pstDateString(d);
    }
    return this.pstDateString();
  }

  /** Inclusive list of YYYY-MM-DD date strings from `from` to `to`. */
  enumerateDates(from: string, to: string): string[] {
    const out: string[] = [];
    const start = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Campaign categorization - we ONLY track 3 verticals for this bot:
  // auto_insurance, pest_control, home_insurance. Everything else is skipped.
  // ---------------------------------------------------------------------------
  categorizeCampaign(campaignName?: string | null): string | null {
    const s = String(campaignName || '').toLowerCase();
    if (s.includes('auto insurance') || s.includes('autoins')) return 'auto_insurance';
    if (s.includes('home insurance') || s.includes('home ins')) return 'home_insurance';
    if (s.includes('pest control') || s.includes('pestcontrol')) return 'pest_control';
    return null;
  }

  static readonly TRACKED_CATEGORIES = ['auto_insurance', 'pest_control', 'home_insurance'];

  /**
   * Bump this whenever the QA logic/prompt changes so history is re-analyzed.
   * existingReviewedIds() only treats rows at the CURRENT version as "done",
   * so the backfill task will automatically re-review older rows and upsert
   * them, then stop once everything is at the current version.
   * v2: only DOLLAR-AMOUNT quotes count; caller_response captured; buckets by
   *     caller response (agree=high, think=medium, decline=low).
   */
  static readonly REVIEW_VERSION = 2;

  /** A quote only counts if the rep stated an actual dollar figure. */
  private hasDollarAmount(v: any): boolean {
    const s = String(v ?? '').trim();
    if (!s || s.toLowerCase() === 'null') return false;
    // must contain at least one digit (covers "$209/mo", "209 a month", "1,540", etc.)
    return /\d/.test(s);
  }

  // ---------------------------------------------------------------------------
  // Fetch: only CONNECTED + CONVERTED (billable) calls that have a recording
  // ---------------------------------------------------------------------------
  async fetchConvertedCalls(dateStr: string): Promise<any[]> {
    const { from, to } = this.pstRange(dateStr);
    const all = await this.td.fetchAllCallsForRange(from, to, 100);
    const converted = all.filter(
      (c) =>
        (String(c.buyer_converted) === 'Converted' || c.buyer_converted === true) &&
        !!c.recording_url,
    );
    // Restrict to the 3 tracked verticals only (auto/home insurance, pest control).
    const tracked = converted.filter(
      (c) => this.categorizeCampaign(c.offer) !== null,
    );
    this.logger.log(
      `Date ${dateStr}: ${all.length} total calls, ${converted.length} converted (billable) with recording, ${tracked.length} in tracked campaigns (auto/home ins, pest)`,
    );
    return tracked;
  }

  private async downloadRecording(url: string): Promise<Buffer> {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (GrovLabs-QA-Bot)' },
    });
    return Buffer.from(resp.data);
  }

  // ---------------------------------------------------------------------------
  // AI analysis
  // ---------------------------------------------------------------------------
  async reviewCall(call: any): Promise<SalesReview> {
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
    const revenue = call.revenue != null ? parseFloat(call.revenue) : null;

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

    // A quote ONLY counts if the rep stated an actual dollar amount.
    const quoteAmount = this.hasDollarAmount(parsed.quote_amount)
      ? String(parsed.quote_amount).trim()
      : null;
    const quoteIssued = parsed.quote_issued === true && quoteAmount !== null;

    // Outcome is driven by the caller's RESPONSE to the dollar quote.
    // If no dollar quote was issued, the call is not part of the sales monitor.
    let outcome: SalesOutcome;
    if (!quoteIssued) {
      outcome = 'no_quote_issued';
    } else {
      const mapped = this.normalizeOutcome(parsed.outcome_category);
      // Guard: if the model still returned no_quote despite a dollar amount,
      // treat it as "received/reviewing" so it stays in the monitor.
      outcome = mapped === 'no_quote_issued' ? 'quote_received_reviewing' : mapped;
      // Objective anchor: if payment was actually collected on the call, it is a
      // completed sale regardless of how the verbal response was bucketed. This
      // keeps sale_completed detection stable across re-reviews instead of
      // depending purely on the model's stochastic reading of the conversation.
      if (parsed.payment_collected === true) {
        outcome = 'sale_completed';
      }
    }

    const callerResponse =
      parsed.caller_response && String(parsed.caller_response).toLowerCase() !== 'null'
        ? String(parsed.caller_response)
        : null;

    return {
      trackdrive_call_id: String(call.id),
      vendor_name: vendorName,
      vendor_td_id: call.traffic_source_id ? String(call.traffic_source_id) : null,
      buyer_name: buyerName,
      buyer_td_id: call.buyer_id ? String(call.buyer_id) : null,
      campaign_name: campaignName,
      campaign_category: this.categorizeCampaign(campaignName),
      caller_number: callerNumber,
      caller_city: callerCity,
      caller_state: callerState,
      number_called: numberCalled,
      duration,
      call_status: status,
      revenue,
      quote_issued: quoteIssued,
      outcome_category: outcome,
      follow_through_likelihood: this.normalizeFollowThrough(
        parsed.follow_through_likelihood,
        outcome,
      ),
      quote_type: parsed.quote_type && parsed.quote_type !== 'null' ? String(parsed.quote_type) : null,
      quote_amount: quoteAmount,
      payment_mentioned: parsed.payment_mentioned === true,
      what_happened: parsed.what_happened || '',
      key_quote: parsed.key_quote && parsed.key_quote !== 'null' ? String(parsed.key_quote) : null,
      caller_response: callerResponse,
      recording_url: recordingUrl,
      raw_ai_response: parsed,
    };
  }

  private normalizeOutcome(v: any): SalesOutcome {
    const s = String(v || '').toLowerCase();
    if (s.includes('sale') || s.includes('paid') || s.includes('enrolled')) return 'sale_completed';
    if (s.includes('defer') || s.includes('payday') || s.includes('later')) return 'quote_accepted_deferred';
    if (s.includes('approval') || s.includes('spouse') || s.includes('family')) return 'quote_pending_approval';
    if (s.includes('review') || s.includes('undecided') || s.includes('received')) return 'quote_received_reviewing';
    if (s.includes('declin') || s.includes('not_interested') || s.includes('reject')) return 'quote_declined';
    return 'no_quote_issued';
  }

  /**
   * Likelihood of an eventual sale, driven by the caller's response to the
   * dollar quote (per GrovLabs): agreed => high, thinking about it => medium,
   * declined => low. Calls with no dollar quote are excluded from the monitor
   * and get 'none'. We derive strictly from the outcome bucket so the badge is
   * always consistent with the caller's response, regardless of what the model
   * put in the follow_through field.
   */
  private normalizeFollowThrough(_v: any, outcome: SalesOutcome): FollowThrough {
    switch (outcome) {
      case 'sale_completed':
      case 'quote_accepted_deferred':
        return 'high';
      case 'quote_pending_approval':
      case 'quote_received_reviewing':
        return 'medium';
      case 'quote_declined':
        return 'low';
      default:
        return 'none';
    }
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
    return [
      'You are a SALES-MONITORING QA analyst for GrovLabs Inc, a company that sells INBOUND insurance and home-services calls (auto insurance, home insurance, pest control, etc.) to buyers under a REAL-TIME BIDDING model.',
      '',
      "GrovLabs is paid per LEAD. The BUYER's economics depend on how many billable calls actually turn into a real PRICED QUOTE and eventually a paying customer. Your ONLY job is to listen to this call and determine (1) whether the rep gave the caller an actual DOLLAR-AMOUNT quote, and if so (2) how the caller RESPONDED to that dollar quote.",
      '',
      'THE SINGLE MOST IMPORTANT RULE - A QUOTE ONLY COUNTS IF A SPECIFIC DOLLAR AMOUNT WAS STATED:',
      'The rep must state an actual price/premium in dollars to the caller - for example "your monthly premium would be $142", "I can do full coverage for $89 a month", "the six-month policy is $540", "it will be $209 a month plus a $99 setup fee".',
      'If NO specific dollar figure was given to the caller, then quote_issued MUST be false and quote_amount MUST be null - REGARDLESS of how long or how positive the call was. The following are NOT quotes: gathering information, verifying eligibility, checking coverage, describing plans generically without a price, promising to call back with a price, transferring the call, wrong number, wrong company, disqualified, or the caller hanging up before any price was stated.',
      'Be strict. When in doubt, if you did not clearly hear a dollar amount presented to the caller, set quote_issued=false. It is a serious error to include a call that never received a dollar quote.',
      '',
      'IF (and only if) a dollar-amount quote WAS given, classify the CALLER RESPONSE into exactly ONE outcome_category:',
      '- "sale_completed": The caller AGREED and payment was actually taken on THIS call - the caller read out / provided a credit or debit card number, gave bank/routing info, explicitly authorized the rep to charge them now, or the rep confirmed the policy was BOUND and active with payment collected. This is a completed sale. Do NOT downgrade a genuine completed sale just because the caller was hesitant earlier in the call - if payment was collected by the end, it is sale_completed.',
      '- "quote_accepted_deferred": The caller AGREED / wants to move forward but not right now - e.g. "call me back when I get paid on the 15th", "start it next month", "I want it, just set it up after my paycheck". Clear intent to buy, payment simply deferred.',
      '- "quote_pending_approval": The caller is interested but must get approval from someone else first - e.g. "I need to check with my wife/husband/son", "let me talk to my spouse".',
      '- "quote_received_reviewing": The caller got the dollar quote but is undecided / thinking about it / wants it emailed to review - e.g. "let me think about it", "send me the details", "I will call you back". No clear yes or no.',
      '- "quote_declined": The caller said NO / not interested / too expensive / already covered AFTER hearing the dollar amount.',
      '- "no_quote_issued": Use this whenever quote_issued is false (no dollar amount was presented to the caller).',
      '',
      'CALLER RESPONSE FIELD (required): In caller_response, write ONE short sentence describing exactly how the caller reacted to the dollar amount - quote their reaction where possible. Examples: "Agreed and gave a debit card to start today.", "Said $209/mo was doable but wants to start after payday on the 15th.", "Wants to check with her husband before deciding.", "Said it was too expensive and declined.", "Asked them to email the quote so she can think about it." If no dollar quote was issued, set caller_response to null.',
      '',
      'follow_through_likelihood is derived from the response: agreed => high, thinking/needs approval => medium, declined => low, no quote => none. (We recompute this ourselves, but fill it consistently.)',
      '',
      'CALL METADATA (for reference - always verify against what you actually hear):',
      `- Vendor (traffic source): ${ctx.vendorName}`,
      `- Buyer / office that took the call: ${ctx.buyerName || 'Unknown'}`,
      `- Campaign: ${ctx.campaignName || 'Unknown'}`,
      `- Total duration: ${ctx.duration}s | Answered: ${ctx.answeredDuration}s | Agent talk: ${ctx.agentDuration}s`,
      `- Status: ${ctx.status || 'unknown'} | Disposition: ${ctx.disposition || 'none'} | Caller state: ${ctx.callerState || 'unknown'}`,
      '',
      'Respond with RAW JSON ONLY (no markdown, no code fences) in this exact shape:',
      '{',
      '  "quote_issued": <true only if a specific dollar amount was stated to the caller, else false>,',
      '  "quote_amount": "<the exact dollar figure(s) the rep quoted, e.g. $142/mo or $540 six-month; MUST be null if quote_issued is false>",',
      '  "outcome_category": "<sale_completed|quote_accepted_deferred|quote_pending_approval|quote_received_reviewing|quote_declined|no_quote_issued>",',
      '  "caller_response": "<one short sentence on how the caller responded to the dollar quote, or null if no quote>",',
      '  "follow_through_likelihood": "<high|medium|low|none>",',
      '  "quote_type": "<auto_insurance|home_insurance|pest_control|other|null>",',
      '  "payment_mentioned": <true|false>,',
      '  "payment_collected": <true ONLY if the caller actually provided payment on THIS call - read out a card/bank number, or explicitly authorized the rep to charge them now, or the rep confirmed the policy was bound and paid. Agreeing to pay LATER, being ASKED for a card, or merely discussing price is NOT payment_collected. When true, this call is a completed sale.>,',
      '  "what_happened": "<2-3 sentence plain-English summary focused on the dollar quote and the caller response>",',
      '  "key_quote": "<a short representative line the CALLER said that supports your classification, or null>"',
      '}',
    ].join('\n');
  }

  // ---------------------------------------------------------------------------
  // Batching + persistence
  // ---------------------------------------------------------------------------
  async reviewCallsBatched(
    calls: any[],
    concurrency = 5,
  ): Promise<{ reviews: SalesReview[]; failures: { id: string; error: string }[] }> {
    const reviews: SalesReview[] = [];
    const failures: { id: string; error: string }[] = [];
    let idx = 0;

    const worker = async () => {
      while (idx < calls.length) {
        const current = calls[idx++];
        try {
          const review = await this.reviewCall(current);
          reviews.push(review);
        } catch (err: any) {
          this.logger.warn(`Sales review failed for call ${current?.id}: ${err.message}`);
          failures.push({ id: String(current?.id), error: err.message });
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, calls.length) }, () => worker());
    await Promise.all(workers);
    return { reviews, failures };
  }

  async storeReviews(reviews: SalesReview[], reviewDate: string): Promise<number> {
    let stored = 0;

    // Sticky sale protection: a call already recorded as a completed sale must
    // never be silently downgraded by a later (stochastic) re-review, as long as
    // the new review still shows a dollar quote was issued. Completed sales are
    // rare, high-value events; we err on the side of preserving them.
    const ids = reviews.map((r) => r.trackdrive_call_id);
    const existingSales = new Set<string>();
    if (ids.length > 0) {
      const prior = await this.prisma.sales_qa_review.findMany({
        where: {
          review_date: reviewDate,
          trackdrive_call_id: { in: ids },
          outcome_category: 'sale_completed',
        },
        select: { trackdrive_call_id: true },
      });
      for (const p of prior) existingSales.add(p.trackdrive_call_id);
    }

    for (const r of reviews) {
      if (
        existingSales.has(r.trackdrive_call_id) &&
        r.outcome_category !== 'sale_completed' &&
        r.quote_issued
      ) {
        r.outcome_category = 'sale_completed';
        r.follow_through_likelihood = 'high';
      }
      try {
        const payload = {
          vendor_name: r.vendor_name,
          vendor_td_id: r.vendor_td_id,
          buyer_name: r.buyer_name,
          buyer_td_id: r.buyer_td_id,
          campaign_name: r.campaign_name,
          campaign_category: r.campaign_category,
          caller_number: r.caller_number,
          caller_city: r.caller_city,
          caller_state: r.caller_state,
          number_called: r.number_called,
          duration: r.duration,
          call_status: r.call_status,
          revenue: r.revenue,
          quote_issued: r.quote_issued,
          outcome_category: r.outcome_category,
          follow_through_likelihood: r.follow_through_likelihood,
          quote_type: r.quote_type,
          quote_amount: r.quote_amount,
          payment_mentioned: r.payment_mentioned,
          what_happened: r.what_happened,
          key_quote: r.key_quote,
          caller_response: r.caller_response,
          review_version: SalesQaService.REVIEW_VERSION,
          recording_url: r.recording_url,
          raw_ai_response: r.raw_ai_response,
        };
        await this.prisma.sales_qa_review.upsert({
          where: {
            trackdrive_call_id_review_date: {
              trackdrive_call_id: r.trackdrive_call_id,
              review_date: reviewDate,
            },
          },
          update: payload,
          create: {
            trackdrive_call_id: r.trackdrive_call_id,
            review_date: reviewDate,
            ...payload,
          },
        });
        stored++;
      } catch (err: any) {
        this.logger.warn(`Failed to store sales review for call ${r.trackdrive_call_id}: ${err.message}`);
      }
    }
    return stored;
  }

  async getReviews(reviewDate: string) {
    // Only calls that received an actual dollar-amount quote belong in the
    // sales monitor - exclude no_quote_issued rows.
    return this.prisma.sales_qa_review.findMany({
      where: {
        review_date: reviewDate,
        quote_issued: true,
        quote_amount: { not: null },
        outcome_category: { not: 'no_quote_issued' },
      },
      orderBy: [{ buyer_name: 'asc' }, { outcome_category: 'asc' }],
    });
  }

  /**
   * Range query used by the admin dashboard: returns per-campaign and
   * per-vendor sales funnel aggregates between two dates (inclusive), plus the
   * raw rows. Optionally filter to a single campaign_category.
   */
  async aggregateRange(from: string, to: string, category?: string) {
    // Only quoted calls belong in the sales monitor.
    const where: any = {
      review_date: { gte: from, lte: to },
      quote_issued: true,
      quote_amount: { not: null },
      outcome_category: { not: 'no_quote_issued' },
    };
    if (category && SalesQaService.TRACKED_CATEGORIES.includes(category)) {
      where.campaign_category = category;
    }
    const rows = await this.prisma.sales_qa_review.findMany({
      where,
      orderBy: [{ review_date: 'asc' }, { campaign_category: 'asc' }],
    });

    const blank = () => ({
      total: 0,
      quotesIssued: 0,
      sale_completed: 0,
      quote_accepted_deferred: 0,
      quote_pending_approval: 0,
      quote_received_reviewing: 0,
      quote_declined: 0,
      no_quote_issued: 0,
    });
    const bump = (acc: any, r: any) => {
      acc.total++;
      if (r.quote_issued) acc.quotesIssued++;
      if (acc[r.outcome_category] !== undefined) acc[r.outcome_category]++;
    };

    const byCampaign: Record<string, any> = {};
    const byCampaignVendor: Record<string, Record<string, any>> = {};
    const overall = blank();
    for (const r of rows) {
      const cat = r.campaign_category || 'uncategorized';
      byCampaign[cat] = byCampaign[cat] || blank();
      bump(byCampaign[cat], r);
      byCampaignVendor[cat] = byCampaignVendor[cat] || {};
      const v = r.vendor_name || 'Unknown Vendor';
      byCampaignVendor[cat][v] = byCampaignVendor[cat][v] || blank();
      bump(byCampaignVendor[cat][v], r);
      bump(overall, r);
    }

    // Headline funnel for the whole period, in the exact buckets the dashboard
    // shows. "buyer_intent" = the caller agreed to buy but deferred payment
    // (accepted/deferred). "undecided_reviewing" captures the still-thinking /
    // needs-approval calls so nothing is dropped from the total.
    const headline = {
      total_quotes_given: overall.total,
      sale_completed: overall.sale_completed,
      buyer_intent: overall.quote_accepted_deferred,
      quote_declined: overall.quote_declined,
      undecided_reviewing:
        overall.quote_received_reviewing + overall.quote_pending_approval,
    };

    return {
      from,
      to,
      category: category || 'all',
      totalReviews: rows.length,
      headline,
      byCampaign,
      byCampaignVendor,
    };
  }

  /**
   * trackdrive_call_ids already reviewed for a date AT THE CURRENT REVIEW
   * VERSION. Rows from an older version are treated as not-done, so bumping
   * REVIEW_VERSION causes history to be re-analyzed and upserted.
   */
  async existingReviewedIds(reviewDate: string): Promise<Set<string>> {
    const rows = await this.prisma.sales_qa_review.findMany({
      where: { review_date: reviewDate, review_version: SalesQaService.REVIEW_VERSION },
      select: { trackdrive_call_id: true },
    });
    return new Set(rows.map((r) => r.trackdrive_call_id));
  }

  /**
   * Incrementally process a single date: fetch tracked/converted calls, skip any
   * already reviewed for that date, AI-review the rest (up to `cap`), and store.
   * Designed to be called repeatedly (e.g. hourly during work hours) - it only
   * spends AI credits on calls that have not been reviewed yet.
   */
  async runIncremental(
    dateStr: string,
    options?: { cap?: number },
  ): Promise<{
    date: string;
    tracked: number;
    alreadyReviewed: number;
    newReviewed: number;
    failures: number;
    stored: number;
  }> {
    const cap = options?.cap ?? 400;
    const tracked = await this.fetchConvertedCalls(dateStr);
    const done = await this.existingReviewedIds(dateStr);
    const pending = tracked.filter((c) => !done.has(String(c.id))).slice(0, cap);

    if (pending.length === 0) {
      this.logger.log(
        `Incremental ${dateStr}: ${tracked.length} tracked, all already reviewed, nothing new.`,
      );
      return {
        date: dateStr,
        tracked: tracked.length,
        alreadyReviewed: done.size,
        newReviewed: 0,
        failures: 0,
        stored: 0,
      };
    }

    const { reviews, failures } = await this.reviewCallsBatched(pending, 5);
    const stored = await this.storeReviews(reviews, dateStr);
    this.logger.log(
      `Incremental ${dateStr}: ${tracked.length} tracked, ${done.size} already reviewed, ${reviews.length} new reviewed, ${failures.length} failures, ${stored} stored.`,
    );
    return {
      date: dateStr,
      tracked: tracked.length,
      alreadyReviewed: done.size,
      newReviewed: reviews.length,
      failures: failures.length,
      stored,
    };
  }

  /**
   * Backfill driver: scans days from `from` to `to`, and reviews un-reviewed
   * tracked calls up to a per-invocation budget (`maxCalls`). Idempotent and
   * resumable - safe to call repeatedly (e.g. from an external scheduled task)
   * until `done` is true. Survives container suspends because each call does a
   * bounded chunk of work.
   */
  async backfillChunk(
    from: string,
    to: string,
    maxCalls = 60,
  ): Promise<{
    from: string;
    to: string;
    daysScanned: number;
    reviewed: number;
    stored: number;
    failures: number;
    budgetLeft: number;
    lastDate: string | null;
    done: boolean;
  }> {
    const dates = this.enumerateDates(from, to);
    let budget = maxCalls;
    let reviewedTotal = 0;
    let storedTotal = 0;
    let failuresTotal = 0;
    let daysScanned = 0;
    let lastDate: string | null = null;
    let done = true;

    for (const d of dates) {
      if (budget <= 0) {
        done = false;
        break;
      }
      daysScanned++;
      lastDate = d;
      const tracked = await this.fetchConvertedCalls(d);
      const already = await this.existingReviewedIds(d);
      const pending = tracked.filter((c) => !already.has(String(c.id)));
      if (pending.length === 0) continue;

      const slice = pending.slice(0, budget);
      const { reviews, failures } = await this.reviewCallsBatched(slice, 5);
      const stored = await this.storeReviews(reviews, d);
      reviewedTotal += reviews.length;
      storedTotal += stored;
      failuresTotal += failures.length;
      budget -= slice.length;

      // If this day still had more pending than our slice, we are not done.
      if (pending.length > slice.length) {
        done = false;
        break;
      }
    }

    this.logger.log(
      `Backfill chunk ${from}..${to}: scanned ${daysScanned} days, reviewed ${reviewedTotal}, stored ${storedTotal}, failures ${failuresTotal}, done=${done} (lastDate ${lastDate})`,
    );
    return {
      from,
      to,
      daysScanned,
      reviewed: reviewedTotal,
      stored: storedTotal,
      failures: failuresTotal,
      budgetLeft: budget,
      lastDate,
      done,
    };
  }

  /**
   * Targeted recovery pass: re-reviews only the calls that could plausibly hide
   * a completed sale (a dollar quote was issued and payment was mentioned) but
   * are NOT currently marked as a sale. Applies the improved payment-collected
   * detection and promotes true sales back to sale_completed, without triggering
   * a full re-review of the whole universe. Bounded/resumable like backfill.
   */
  async recheckSales(
    from: string,
    to: string,
    category: string | undefined,
    maxCalls = 60,
  ): Promise<{
    from: string;
    to: string;
    category: string;
    candidatesScanned: number;
    reviewed: number;
    stored: number;
    promotedToSale: number;
    failures: number;
    budgetLeft: number;
    lastDate: string | null;
    done: boolean;
  }> {
    const dates = this.enumerateDates(from, to);
    let budget = maxCalls;
    let candidatesScanned = 0;
    let reviewed = 0;
    let stored = 0;
    let promoted = 0;
    let failures = 0;
    let lastDate: string | null = null;
    let done = true;

    for (const d of dates) {
      if (budget <= 0) {
        done = false;
        break;
      }
      lastDate = d;
      const where: any = {
        review_date: d,
        quote_issued: true,
        payment_mentioned: true,
        outcome_category: { not: 'sale_completed' },
      };
      if (category && SalesQaService.TRACKED_CATEGORIES.includes(category)) {
        where.campaign_category = category;
      }
      const candidates = await this.prisma.sales_qa_review.findMany({
        where,
        select: { trackdrive_call_id: true },
      });
      if (candidates.length === 0) continue;
      candidatesScanned += candidates.length;
      const candIds = new Set(candidates.map((c) => c.trackdrive_call_id));

      const tracked = await this.fetchConvertedCalls(d);
      const toReview = tracked
        .filter((c) => candIds.has(String(c.id)))
        .slice(0, budget);
      if (toReview.length === 0) continue;

      const { reviews, failures: f } = await this.reviewCallsBatched(toReview, 5);
      const s = await this.storeReviews(reviews, d);
      promoted += reviews.filter((r) => r.outcome_category === 'sale_completed').length;
      reviewed += reviews.length;
      stored += s;
      failures += f.length;
      budget -= toReview.length;

      if (candIds.size > toReview.length) {
        done = false;
        break;
      }
    }

    this.logger.log(
      `Recheck sales ${from}..${to} [${category || 'all'}]: candidates ${candidatesScanned}, reviewed ${reviewed}, promoted ${promoted}, failures ${failures}, done=${done} (lastDate ${lastDate})`,
    );
    return {
      from,
      to,
      category: category || 'all',
      candidatesScanned,
      reviewed,
      stored,
      promotedToSale: promoted,
      failures,
      budgetLeft: budget,
      lastDate,
      done,
    };
  }

  // ---------------------------------------------------------------------------
  // Reporting
  // ---------------------------------------------------------------------------
  private escapeHtml(str: string): string {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Aggregate reviews per buyer with the sales funnel counts. */
  private aggregateByBuyer(reviews: SalesReview[]) {
    const groups = new Map<string, SalesReview[]>();
    for (const r of reviews) {
      const k = r.buyer_name || 'Unknown Buyer';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const out = Array.from(groups.entries()).map(([buyer, rs]) => {
      const total = rs.length;
      const quotesIssued = rs.filter((r) => r.quote_issued).length;
      const counts: Record<SalesOutcome, number> = {
        sale_completed: 0,
        quote_accepted_deferred: 0,
        quote_pending_approval: 0,
        quote_received_reviewing: 0,
        quote_declined: 0,
        no_quote_issued: 0,
      };
      for (const r of rs) counts[r.outcome_category]++;
      const sales = counts.sale_completed;
      const potential = counts.quote_accepted_deferred + counts.quote_pending_approval;
      return {
        buyer,
        total,
        quotesIssued,
        quoteRate: total > 0 ? (quotesIssued / total) * 100 : 0,
        sales,
        saleRate: total > 0 ? (sales / total) * 100 : 0,
        potential,
        counts,
        examples: rs.filter((r) => r.quote_issued).slice(0, 3),
      };
    });
    return out.sort((a, b) => b.total - a.total);
  }

  private overallTotals(reviews: SalesReview[]) {
    const total = reviews.length;
    const quotesIssued = reviews.filter((r) => r.quote_issued).length;
    const sales = reviews.filter((r) => r.outcome_category === 'sale_completed').length;
    const deferred = reviews.filter((r) => r.outcome_category === 'quote_accepted_deferred').length;
    const pending = reviews.filter((r) => r.outcome_category === 'quote_pending_approval').length;
    const reviewing = reviews.filter((r) => r.outcome_category === 'quote_received_reviewing').length;
    const declined = reviews.filter((r) => r.outcome_category === 'quote_declined').length;
    const noQuote = reviews.filter((r) => r.outcome_category === 'no_quote_issued').length;
    return { total, quotesIssued, sales, deferred, pending, reviewing, declined, noQuote };
  }

  buildEmailHtml(
    reviews: SalesReview[],
    dateStr: string,
    meta?: { totalConverted?: number; reviewed?: number; failures?: number },
  ): string {
    const t = this.overallTotals(reviews);
    const byBuyer = this.aggregateByBuyer(reviews);

    const card = (label: string, value: string | number, color: string) =>
      `<div style="flex:1;min-width:110px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center;"><div style="font-size:24px;font-weight:700;color:${color};line-height:1;">${value}</div><div style="font-size:11px;color:#6b7280;margin-top:6px;text-transform:uppercase;letter-spacing:.04em;">${label}</div></div>`;

    const chip = (label: string, count: number, bg: string, fg: string) =>
      count > 0
        ? `<span style="display:inline-block;background:${bg};color:${fg};border-radius:12px;padding:3px 10px;margin:2px 4px 2px 0;font-size:12px;">${label}: <b>${count}</b></span>`
        : '';

    const buyerRows = byBuyer
      .map((g) => {
        const chips =
          chip('Sale', g.counts.sale_completed, '#dcfce7', '#166534') +
          chip('Deferred', g.counts.quote_accepted_deferred, '#dbeafe', '#1e40af') +
          chip('Pending Approval', g.counts.quote_pending_approval, '#fef9c3', '#854d0e') +
          chip('Reviewing', g.counts.quote_received_reviewing, '#f3f4f6', '#374151') +
          chip('Declined', g.counts.quote_declined, '#fee2e2', '#991b1b') +
          chip('No Quote', g.counts.no_quote_issued, '#f3f4f6', '#6b7280');
        const ex = g.examples[0];
        const exLine = ex
          ? `<div style="font-size:12px;color:#6b7280;margin-top:8px;font-style:italic;">e.g. ${this.escapeHtml((ex.what_happened || '').slice(0, 200))}</div>`
          : '';
        return `<tr><td style="padding:14px 12px;border-bottom:1px solid #eef0f3;vertical-align:top;"><div style="font-weight:600;color:#111827;font-size:15px;">${this.escapeHtml(g.buyer)}</div><div style="font-size:12px;color:#6b7280;margin-top:2px;">${g.total} billable calls, ${g.quotesIssued} quotes issued (${g.quoteRate.toFixed(0)}%), ${g.sales} sales (${g.saleRate.toFixed(0)}%)</div><div style="margin-top:8px;">${chips}</div>${exLine}</td></tr>`;
      })
      .join('');

    const metaLine = meta
      ? `<p style="font-size:12px;color:#cbd5e1;margin:6px 0 0;">${meta.totalConverted ?? t.total} converted (billable) calls with recordings, ${meta.reviewed ?? t.total} reviewed${meta.failures ? `, ${meta.failures} could not be analyzed` : ''}</p>`
      : '';

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#065f46,#047857);border-radius:12px;padding:24px;color:#fff;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">GrovLabs Inc - Sales QA</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">Daily Sales Monitoring - Billable Calls</div>
      <div style="font-size:14px;opacity:.9;margin-top:2px;">${dateStr}</div>
      ${metaLine}
    </div>

    <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
      ${card('Billable Reviewed', t.total, '#111827')}
      ${card('Quotes Issued', t.quotesIssued, '#047857')}
      ${card('Sales', t.sales, '#166534')}
      ${card('Potential Follow-Through', t.deferred + t.pending, '#1e40af')}
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-top:16px;">
      <div style="font-size:13px;color:#374151;"><b>${t.sales}</b> sale(s), <b>${t.deferred}</b> accepted/deferred, <b>${t.pending}</b> pending approval, <b>${t.reviewing}</b> reviewing, <b>${t.declined}</b> declined, <b>${t.noQuote}</b> no quote issued</div>
    </div>

    <div style="margin-top:28px;">
      <h2 style="font-size:18px;color:#111827;margin:0 0 4px;">By Buyer (Quote &amp; Sale Funnel)</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">How many of each buyer's billable calls turned into an actual quote, a sale, or a potential follow-through. Use this to track buyer CPA.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;"><tbody>${buyerRows || '<tr><td style="padding:16px;color:#6b7280;font-size:14px;">No billable calls with recordings for this date.</td></tr>'}</tbody></table>
    </div>

    <p style="font-size:12px;color:#9ca3af;margin-top:28px;text-align:center;">Automated report from the GrovLabs QA Agent.</p>
  </div>
</body>
</html>`;
  }

  buildTelegramSummary(reviews: SalesReview[], dateStr: string): string {
    const t = this.overallTotals(reviews);
    const byBuyer = this.aggregateByBuyer(reviews);

    const lines: string[] = [];
    lines.push(`<b>Sales QA - ${this.escapeHtml(dateStr)}</b>`);
    lines.push('');
    lines.push(
      `Reviewed <b>${t.total}</b> billable (converted) calls - Quotes issued: <b>${t.quotesIssued}</b>, Sales: <b>${t.sales}</b>`,
    );
    lines.push(
      `Accepted/Deferred: <b>${t.deferred}</b>, Pending approval: <b>${t.pending}</b>, Reviewing: <b>${t.reviewing}</b>, Declined: <b>${t.declined}</b>, No quote: <b>${t.noQuote}</b>`,
    );

    if (byBuyer.length) {
      lines.push('');
      lines.push('<b>By buyer</b>');
      for (const g of byBuyer.slice(0, 8)) {
        lines.push(
          `- ${this.escapeHtml(g.buyer)}: <b>${g.total}</b> calls, ${g.quotesIssued} quotes (${g.quoteRate.toFixed(0)}%), ${g.sales} sales, ${g.potential} potential`,
        );
      }
    }

    lines.push('');
    lines.push('Full breakdown sent to your email.');
    return lines.join('\n');
  }

  private async sendEmail(subject: string, html: string, recipients: string[]): Promise<void> {
    const hostname = (() => {
      try {
        return new URL(process.env.APP_ORIGIN || 'https://grovlabs.com').hostname;
      } catch {
        return 'grovlabs.com';
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
            notification_id: process.env.NOTIF_ID_SALES_QA_REPORT,
            subject,
            body: html,
            is_html: true,
            recipient_email: recipient,
            sender_email: `noreply@${hostname}`,
            sender_alias: 'GrovLabs Inc',
            reply_to: 'uj@grovlabs.com',
          }),
        });
        const result = (await response.json()) as any;
        if (!result.success && !result.notification_disabled) {
          this.logger.error(`Sales QA report email failed for ${recipient}: ${result.message}`);
        } else {
          this.logger.log(`Sales QA report email sent to ${recipient}`);
        }
      } catch (err: any) {
        this.logger.error(`Sales QA email error for ${recipient}: ${err.message}`);
      }
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID', '');
    if (!botToken || !chatId) {
      this.logger.warn('Telegram not configured; skipping sales summary');
      return;
    }
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      this.logger.log('Sales QA Telegram summary sent');
    } catch (err: any) {
      this.logger.error(`Sales QA Telegram summary failed: ${err.message}`);
    }
  }

  async runDailyReview(
    dateStr: string,
    options?: { cap?: number; notify?: boolean },
  ): Promise<{
    date: string;
    totalConverted: number;
    reviewed: number;
    failures: number;
    stored: number;
    quotesIssued: number;
    sales: number;
  }> {
    const cap = options?.cap ?? 300;
    const notify = options?.notify ?? true;

    this.logger.log(`Starting sales QA review for ${dateStr} (cap ${cap})`);
    const converted = await this.fetchConvertedCalls(dateStr);
    const totalConverted = converted.length;
    const toReview = converted.slice(0, cap);

    const { reviews, failures } = await this.reviewCallsBatched(toReview, 5);
    const stored = await this.storeReviews(reviews, dateStr);

    const quotesIssued = reviews.filter((r) => r.quote_issued).length;
    const sales = reviews.filter((r) => r.outcome_category === 'sale_completed').length;

    if (notify) {
      const subject = `Sales QA - ${dateStr}: ${reviews.length} billable reviewed (${quotesIssued} quotes, ${sales} sales)`;
      const html = this.buildEmailHtml(reviews, dateStr, {
        totalConverted,
        reviewed: reviews.length,
        failures: failures.length,
      });
      await this.sendEmail(subject, html, ['uj@grovlabs.com']);
      await this.sendTelegram(this.buildTelegramSummary(reviews, dateStr));
    }

    this.logger.log(
      `Sales QA review for ${dateStr} complete: reviewed ${reviews.length}, failures ${failures.length}, stored ${stored}, quotes ${quotesIssued}, sales ${sales}`,
    );

    return {
      date: dateStr,
      totalConverted,
      reviewed: reviews.length,
      failures: failures.length,
      stored,
      quotesIssued,
      sales,
    };
  }
}