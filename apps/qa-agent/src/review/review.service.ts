import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { TranscriptionService } from '../transcription/transcription.service.js';
import { AnalysisService, AnalysisResult } from '../analysis/analysis.service.js';
import { TelegramService } from '../telegram/telegram.service.js';
import { CAMPAIGN_DURATION_THRESHOLDS } from '../config/constants.js';

export interface HistoricalReviewOptions {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  offerFilter?: string; // e.g. "Auto Insurance RTB"
  trafficSourceFilter?: string;
  skipAlreadyAnalyzed?: boolean; // default true
  maxCalls?: number; // safety limit, default 50
  minDuration?: number; // override threshold, optional
}

export interface ReviewResult {
  callId: string;
  trackdriveCallId: string;
  callerNumber: string;
  affiliateName: string;
  campaignName: string;
  buyerName: string;
  duration: number;
  isFlagged: boolean;
  confidenceScore: number;
  flagReason: string;
  aiSummary: string;
  detectedTriggers: string[];
}

export interface ReviewSummary {
  reviewId: string;
  dateRange: string;
  offerFilter: string;
  totalCallsFetched: number;
  totalQualifying: number;
  totalAnalyzed: number;
  totalFlagged: number;
  totalClean: number;
  totalSkipped: number;
  totalErrors: number;
  flaggedCalls: ReviewResult[];
  durationMs: number;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  // Track active reviews to prevent concurrent runs
  private activeReview: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackdrive: TrackDriveService,
    private readonly transcription: TranscriptionService,
    private readonly analysis: AnalysisService,
    private readonly telegram: TelegramService,
  ) {}

  async runHistoricalReview(options: HistoricalReviewOptions): Promise<ReviewSummary> {
    if (this.activeReview) {
      throw new Error(`A review is already in progress: ${this.activeReview}`);
    }

    const reviewId = `review_${Date.now()}`;
    this.activeReview = reviewId;
    const startTime = Date.now();

    const maxCalls = options.maxCalls || 50;
    const skipAnalyzed = options.skipAlreadyAnalyzed !== false;

    this.logger.log(`Starting historical review ${reviewId}: ${options.dateFrom} to ${options.dateTo}, offer: ${options.offerFilter || 'ALL'}`);

    // Notify via Telegram that review is starting
    await this.telegram.sendMessage(
      `🔍 <b>HISTORICAL REVIEW STARTING</b>\n\n` +
      `📅 ${options.dateFrom} → ${options.dateTo}\n` +
      `📋 Offer: ${options.offerFilter || 'All offers'}\n` +
      `📊 Max calls: ${maxCalls}\n\n` +
      `⏳ This may take several minutes...`
    );

    try {
      // Step 1: Fetch all calls from TrackDrive for the date range
      const allCalls = await this.fetchAllCalls(options.dateFrom, options.dateTo);
      this.logger.log(`Fetched ${allCalls.length} total calls from TrackDrive`);

      // Step 2: Filter by offer if specified
      let filtered = allCalls;
      if (options.offerFilter) {
        const offerLower = options.offerFilter.toLowerCase();
        filtered = filtered.filter(c =>
          (c.offer || '').toLowerCase().includes(offerLower)
        );
      }
      if (options.trafficSourceFilter) {
        const tsLower = options.trafficSourceFilter.toLowerCase();
        filtered = filtered.filter(c =>
          (c.traffic_source || '').toLowerCase().includes(tsLower)
        );
      }

      // Step 3: Filter to only calls with recordings that meet duration threshold
      const qualifying = filtered.filter(c => {
        if (!c.recording_url) return false;
        const duration = c.total_duration || 0;
        if (options.minDuration !== undefined) {
          return duration >= options.minDuration;
        }
        const threshold = this.getDurationThreshold(c.offer || '');
        return duration >= threshold;
      });

      this.logger.log(`${qualifying.length} calls qualify for analysis (have recording + meet duration threshold)`);

      // Step 4: Skip already analyzed if option set
      let toAnalyze = qualifying;
      let skippedCount = 0;
      if (skipAnalyzed) {
        const existingCallIds = await this.getAlreadyAnalyzedCallIds(
          qualifying.map(c => String(c.id))
        );
        toAnalyze = qualifying.filter(c => !existingCallIds.has(String(c.id)));
        skippedCount = qualifying.length - toAnalyze.length;
        this.logger.log(`Skipping ${skippedCount} already-analyzed calls`);
      }

      // Step 5: Apply max calls limit
      if (toAnalyze.length > maxCalls) {
        this.logger.log(`Limiting to ${maxCalls} calls (${toAnalyze.length} available)`);
        toAnalyze = toAnalyze.slice(0, maxCalls);
      }

      // Step 6: Process each call sequentially (to be kind to API limits)
      const results: ReviewResult[] = [];
      let errorCount = 0;

      for (let i = 0; i < toAnalyze.length; i++) {
        const call = toAnalyze[i];
        this.logger.log(`Analyzing call ${i + 1}/${toAnalyze.length}: ${call.id}`);

        try {
          const result = await this.analyzeHistoricalCall(call);
          results.push(result);

          // Brief pause between calls to avoid rate limiting
          if (i < toAnalyze.length - 1) {
            await this.sleep(2000);
          }
        } catch (error: any) {
          this.logger.error(`Failed to analyze call ${call.id}: ${error.message}`);
          errorCount++;
        }
      }

      const flaggedResults = results.filter(r => r.isFlagged);
      const cleanCount = results.filter(r => !r.isFlagged).length;
      const durationMs = Date.now() - startTime;

      const summary: ReviewSummary = {
        reviewId,
        dateRange: `${options.dateFrom} to ${options.dateTo}`,
        offerFilter: options.offerFilter || 'All offers',
        totalCallsFetched: allCalls.length,
        totalQualifying: qualifying.length,
        totalAnalyzed: results.length,
        totalFlagged: flaggedResults.length,
        totalClean: cleanCount,
        totalSkipped: skippedCount,
        totalErrors: errorCount,
        flaggedCalls: flaggedResults,
        durationMs,
      };

      // Step 7: Send summary report to Telegram
      await this.sendReviewSummary(summary);

      this.logger.log(`Historical review ${reviewId} complete: ${results.length} analyzed, ${flaggedResults.length} flagged`);

      return summary;
    } finally {
      this.activeReview = null;
    }
  }

  private async analyzeHistoricalCall(callData: any): Promise<ReviewResult> {
    const trackdriveCallId = String(callData.id);
    const duration = callData.total_duration || 0;
    const recordingUrl = callData.recording_url || '';
    const affiliateName = callData.traffic_source || 'Unknown';
    const affiliateTrackdriveId = String(callData.traffic_source_id || '');
    const campaignName = callData.offer || 'Unknown';
    const campaignId = String(callData.offer_id || '');
    const buyerName = callData.buyer || '';
    const buyerId = String(callData.buyer_id || '');
    const callerNumber = callData.caller_number || '';
    const callerCity = callData.caller_city || '';
    const callerState = callData['token-state'] || '';

    // Upsert affiliate
    let affiliate = null;
    if (affiliateTrackdriveId) {
      affiliate = await this.prisma.affiliate.upsert({
        where: { trackdrive_id: affiliateTrackdriveId },
        update: { name: affiliateName },
        create: {
          trackdrive_id: affiliateTrackdriveId,
          name: affiliateName,
          total_calls: 0,
        },
      });
    }

    // Upsert call record
    const call = await this.prisma.call.upsert({
      where: { trackdrive_call_id: trackdriveCallId },
      update: {
        affiliate_id: affiliate?.id || null,
        campaign_id: campaignId,
        campaign_name: campaignName,
        buyer_id: buyerId,
        buyer_name: buyerName,
        caller_number: callerNumber,
        duration,
        recording_url: recordingUrl,
        trackdrive_data: callData,
      },
      create: {
        trackdrive_call_id: trackdriveCallId,
        affiliate_id: affiliate?.id || null,
        campaign_id: campaignId,
        campaign_name: campaignName,
        buyer_id: buyerId,
        buyer_name: buyerName,
        caller_number: callerNumber,
        duration,
        recording_url: recordingUrl,
        status: 'processing',
        trackdrive_data: callData,
      },
    });

    // Download recording
    const audioBuffer = await this.trackdrive.downloadRecording(recordingUrl);
    this.logger.log(`Recording downloaded for ${trackdriveCallId}: ${audioBuffer.length} bytes`);

    // Transcribe
    const transcript = await this.transcription.transcribeAudio(audioBuffer, `${trackdriveCallId}.mp3`);

    await this.prisma.transcript.upsert({
      where: { call_id: call.id },
      update: { transcript_text: transcript },
      create: {
        call_id: call.id,
        transcript_text: transcript,
        transcription_service: 'abacus_llm',
      },
    });

    // AI Analysis
    const isHighSensitivity =
      affiliate?.high_sensitivity_until != null &&
      new Date(affiliate.high_sensitivity_until) > new Date();

    const analysisResult: AnalysisResult = await this.analysis.analyzeTranscript(
      transcript,
      {
        callId: trackdriveCallId,
        affiliateName,
        campaignName,
        duration,
        isHighSensitivity,
      },
    );

    await this.prisma.qa_analysis.upsert({
      where: { call_id: call.id },
      update: {
        detected_triggers: analysisResult.detected_triggers,
        confidence_score: analysisResult.confidence_score,
        is_flagged: analysisResult.is_flagged,
        flag_reason: analysisResult.flag_reason,
        ai_summary: analysisResult.ai_summary,
        high_sensitivity: isHighSensitivity,
        raw_ai_response: analysisResult.raw_response,
      },
      create: {
        call_id: call.id,
        detected_triggers: analysisResult.detected_triggers,
        confidence_score: analysisResult.confidence_score,
        is_flagged: analysisResult.is_flagged,
        flag_reason: analysisResult.flag_reason,
        ai_summary: analysisResult.ai_summary,
        high_sensitivity: isHighSensitivity,
        raw_ai_response: analysisResult.raw_response,
      },
    });

    // Create flag if flagged
    if (analysisResult.is_flagged) {
      const severity = analysisResult.confidence_score >= 80 ? 'critical'
        : analysisResult.confidence_score >= 60 ? 'high'
        : analysisResult.confidence_score >= 40 ? 'medium'
        : 'low';

      await this.prisma.flag.create({
        data: {
          call_id: call.id,
          affiliate_id: affiliate?.id || null,
          flag_type: 'cold_transfer',
          severity,
          details: analysisResult.flag_reason || analysisResult.ai_summary,
        },
      });

      if (affiliate) {
        await this.prisma.affiliate.update({
          where: { id: affiliate.id },
          data: { flagged_calls: { increment: 1 } },
        });
      }
    }

    // Mark call as analyzed
    await this.prisma.call.update({
      where: { id: call.id },
      data: { status: 'analyzed' },
    });

    return {
      callId: call.id,
      trackdriveCallId,
      callerNumber,
      affiliateName,
      campaignName,
      buyerName,
      duration,
      isFlagged: analysisResult.is_flagged,
      confidenceScore: analysisResult.confidence_score,
      flagReason: analysisResult.flag_reason || '',
      aiSummary: analysisResult.ai_summary,
      detectedTriggers: analysisResult.detected_triggers,
    };
  }

  private async fetchAllCalls(dateFrom: string, dateTo: string): Promise<any[]> {
    const allCalls: any[] = [];
    let cursor: string | null = null;
    let pageNum = 0;
    const maxPages = 20; // Safety limit: 20 pages * 50 = 1000 calls max

    do {
      pageNum++;
      const params: Record<string, any> = {
        per_page: 50,
        sort_by: 'created_at',
        sort_order: 'asc',
        created_at_from: dateFrom,
        created_at_to: dateTo,
      };
      if (cursor) {
        params.cursor = cursor;
      }

      const response = await this.trackdrive.listCalls(params);
      const calls = response?.calls || [];
      allCalls.push(...calls);

      const metadata = response?.metadata || {};
      cursor = metadata.next_cursor ? String(metadata.next_cursor) : null;

      this.logger.log(`Fetched page ${pageNum}: ${calls.length} calls (total so far: ${allCalls.length})`);

      // Brief pause between pages
      if (cursor) {
        await this.sleep(500);
      }
    } while (cursor && pageNum < maxPages);

    return allCalls;
  }

  private async getAlreadyAnalyzedCallIds(trackdriveCallIds: string[]): Promise<Set<string>> {
    const existing = await this.prisma.call.findMany({
      where: {
        trackdrive_call_id: { in: trackdriveCallIds },
        status: 'analyzed',
      },
      select: { trackdrive_call_id: true },
    });
    return new Set(existing.map(c => c.trackdrive_call_id));
  }

  private async sendReviewSummary(summary: ReviewSummary): Promise<void> {
    const flagRate = summary.totalAnalyzed > 0
      ? Math.round((summary.totalFlagged / summary.totalAnalyzed) * 100)
      : 0;

    const durationMin = Math.round(summary.durationMs / 60000);
    const durationSec = Math.round((summary.durationMs % 60000) / 1000);

    let message = `🤖 <b>QA AGENT — HISTORICAL REVIEW COMPLETE</b>\n\n`;
    message += `📅 ${summary.dateRange}\n`;
    message += `📋 ${summary.offerFilter} | ⏱ ${durationMin}m ${durationSec}s\n\n`;

    message += `📞 Total calls: ${summary.totalCallsFetched} | ✅ Qualifying: ${summary.totalQualifying}\n`;
    message += `🔍 Analyzed: ${summary.totalAnalyzed} | ⏭ Skipped: ${summary.totalSkipped} | ❌ Errors: ${summary.totalErrors}\n`;
    message += `🚩 Flagged: <b>${summary.totalFlagged}</b> (${flagRate}%) | 🟢 Clean: <b>${summary.totalClean}</b>\n`;

    if (summary.flaggedCalls.length > 0) {
      message += `\n━━━━━━━━━━━━━━━━━━\n`;

      // Keep flagged call summaries concise to fit in one message
      for (const call of summary.flaggedCalls) {
        const emoji = call.confidenceScore >= 80 ? '🔴' : call.confidenceScore >= 60 ? '🟠' : call.confidenceScore >= 40 ? '🟡' : '🔵';
        message += `${emoji} <b>${call.callerNumber || '?'}</b> ${call.confidenceScore}% | ${call.duration}s\n`;
        message += `   ${this.escapeHtml(call.affiliateName)}`;
        if (call.buyerName) message += ` → ${this.escapeHtml(call.buyerName)}`;
        message += `\n`;
        // Truncate summary to keep message compact
        const shortSummary = call.aiSummary.length > 100 ? call.aiSummary.substring(0, 100) + '...' : call.aiSummary;
        message += `   ${this.escapeHtml(shortSummary)}\n`;
        message += `   <code>${call.trackdriveCallId}</code>\n\n`;
      }
    } else {
      message += `\n✅ <b>All calls look clean. No cold transfers detected.</b>\n`;
    }

    // If still over 4096 limit, truncate flagged list with a note
    if (message.length > 4000) {
      // Rebuild with fewer flagged call details
      let trimmed = `🤖 <b>QA AGENT — HISTORICAL REVIEW COMPLETE</b>\n\n`;
      trimmed += `📅 ${summary.dateRange}\n`;
      trimmed += `📋 ${summary.offerFilter} | ⏱ ${durationMin}m ${durationSec}s\n\n`;
      trimmed += `📞 Total: ${summary.totalCallsFetched} | ✅ Qualifying: ${summary.totalQualifying}\n`;
      trimmed += `🔍 Analyzed: ${summary.totalAnalyzed} | ⏭ Skipped: ${summary.totalSkipped}\n`;
      trimmed += `🚩 Flagged: <b>${summary.totalFlagged}</b> (${flagRate}%) | 🟢 Clean: <b>${summary.totalClean}</b>\n`;
      trimmed += `\n━━━━━━━━━━━━━━━━━━\n`;

      // Show top 10 flagged by confidence, one line each
      const topFlagged = [...summary.flaggedCalls]
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 10);

      for (const call of topFlagged) {
        const emoji = call.confidenceScore >= 80 ? '🔴' : call.confidenceScore >= 60 ? '🟠' : call.confidenceScore >= 40 ? '🟡' : '🔵';
        trimmed += `${emoji} ${call.callerNumber || '?'} ${call.confidenceScore}% | ${this.escapeHtml(call.affiliateName)} | ${call.duration}s\n`;
      }

      if (summary.flaggedCalls.length > 10) {
        trimmed += `\n+${summary.flaggedCalls.length - 10} more flagged calls. Check API for full details.`;
      }

      await this.telegram.sendMessage(trimmed);
    } else {
      await this.telegram.sendMessage(message);
    }
  }

  private getDurationThreshold(campaignName: string): number {
    const normalized = campaignName.toLowerCase();
    for (const [key, value] of Object.entries(CAMPAIGN_DURATION_THRESHOLDS)) {
      if (key !== 'default' && normalized.includes(key)) {
        return value;
      }
    }
    return CAMPAIGN_DURATION_THRESHOLDS.default;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
