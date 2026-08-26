import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';
import { TranscriptionService } from '../transcription/transcription.service.js';
import { AnalysisService, AnalysisResult } from '../analysis/analysis.service.js';
import { DiscordService } from '../discord/discord.service.js';
import { JobQueueService } from '../jobs/job-queue.service.js';
import { QASettingsService } from '../qa-settings/qa-settings.service.js';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackdrive: TrackDriveService,
    private readonly transcription: TranscriptionService,
    private readonly analysis: AnalysisService,
    private readonly discord: DiscordService,
    private readonly jobQueue: JobQueueService,
    private readonly qaSettings: QASettingsService,
  ) {
    // Register the call processing handler
    this.jobQueue.registerHandler('process_call', (data) => this.processCall(data));
  }

  async queueCallForProcessing(trackdriveCallId: string, webhookData: any): Promise<string> {
    this.logger.log(`Queuing call for processing: ${trackdriveCallId}`);

    // Upsert call record first
    const existingCall = await this.prisma.call.findUnique({
      where: { trackdrive_call_id: trackdriveCallId },
    });

    if (existingCall && existingCall.status === 'analyzed') {
      this.logger.log(`Call ${trackdriveCallId} already analyzed, skipping`);
      return existingCall.id;
    }

    const call = await this.prisma.call.upsert({
      where: { trackdrive_call_id: trackdriveCallId },
      update: { status: 'pending', trackdrive_data: webhookData },
      create: {
        trackdrive_call_id: trackdriveCallId,
        status: 'pending',
        trackdrive_data: webhookData,
      },
    });

    await this.jobQueue.addJob('process_call', {
      callId: call.id,
      trackdriveCallId,
      webhookData,
    });

    return call.id;
  }

  private async processCall(data: { callId: string; trackdriveCallId: string; webhookData?: any }): Promise<void> {
    const { callId, trackdriveCallId, webhookData } = data;
    this.logger.log(`Processing call: ${trackdriveCallId}`);

    try {
      // Update status
      await this.prisma.call.update({
        where: { id: callId },
        data: { status: 'processing' },
      });

      // Use webhook data directly - TrackDrive sends data as query params
      // Only fetch from API if webhook data is incomplete
      let callData = webhookData || {};

      // If we have a numeric call ID (not a phone number), try to fetch more details
      const isNumericId = /^\d+$/.test(trackdriveCallId);
      if (isNumericId && !callData.recording_url) {
        this.logger.log(`Step 1: Fetching call details for numeric ID ${trackdriveCallId}`);
        try {
          const callDetails = await this.trackdrive.getCallDetails(trackdriveCallId);
          callData = { ...callData, ...(callDetails?.call || callDetails) };
        } catch (err: any) {
          this.logger.warn(`Could not fetch call details: ${err.message}, using webhook data`);
        }
      } else {
        this.logger.log(`Step 1: Using webhook data directly (call_id is phone number or data complete)`);
      }

      // Map fields - support both webhook query params and API response formats
      const duration = Number(callData?.total_duration) || Number(callData?.answered_duration) || Number(callData?.duration) || Number(callData?.call_duration) || 0;
      this.logger.log(`Call ${trackdriveCallId} duration: total_duration=${callData?.total_duration}, answered_duration=${callData?.answered_duration} => final ${duration}s`);
      const recordingUrl = callData?.recording_url || '';
      const affiliateTrackdriveId = String(callData?.traffic_source_id || '');
      const affiliateName = callData?.traffic_source_name || callData?.traffic_source || 'Unknown';
      const campaignId = String(callData?.offer_id || '');
      const campaignName = callData?.offer || 'Unknown';
      const buyerId = String(callData?.buyer_id || '');
      const buyerName = callData?.buyer || '';
      const callerNumber = callData?.caller_number || callData?.caller_id || '';
      const callerCity = callData?.caller_city || '';
      const callerState = callData?.['token-state'] || '';
      const callCategory = callData?.category || '';

      // Upsert affiliate
      let affiliate = null;
      if (affiliateTrackdriveId) {
        affiliate = await this.prisma.affiliate.upsert({
          where: { trackdrive_id: affiliateTrackdriveId },
          update: {
            name: affiliateName,
            total_calls: { increment: 1 },
          },
          create: {
            trackdrive_id: affiliateTrackdriveId,
            name: affiliateName,
            total_calls: 1,
          },
        });
      }

      // Update call record with details
      await this.prisma.call.update({
        where: { id: callId },
        data: {
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
      });

      // Step 2: Check high-sensitivity mode
      const isHighSensitivity =
        affiliate?.high_sensitivity_until != null &&
        new Date(affiliate.high_sensitivity_until) > new Date();

      // Step 3: Duration threshold check (load settings from DB)
      await this.qaSettings.getSettings();
      const threshold = this.qaSettings.getDurationThreshold(campaignName);
      this.logger.log(`Call ${trackdriveCallId} threshold check: duration=${duration}s, threshold=${threshold}s, campaign=${campaignName}, highSensitivity=${isHighSensitivity}`);
      if (duration < threshold && !isHighSensitivity) {
        this.logger.log(
          `Call ${trackdriveCallId} skipped: duration ${duration}s < threshold ${threshold}s`,
        );
        await this.prisma.call.update({
          where: { id: callId },
          data: { status: 'skipped' },
        });
        return;
      }

      // Step 4: Check recording availability
      if (!recordingUrl) {
        this.logger.log(`Call ${trackdriveCallId}: No recording URL available, skipping QA`);
        await this.prisma.call.update({
          where: { id: callId },
          data: { status: 'skipped' },
        });
        return;
      }

      // Step 5: Download recording
      this.logger.log(`Step 5: Downloading recording for ${trackdriveCallId}`);
      const audioBuffer = await this.trackdrive.downloadRecording(recordingUrl);
      this.logger.log(`Recording downloaded: ${audioBuffer.length} bytes`);

      // Step 6: Transcribe
      this.logger.log(`Step 6: Transcribing call ${trackdriveCallId}`);
      const transcript = await this.transcription.transcribeAudio(audioBuffer, `${trackdriveCallId}.mp3`);

      await this.prisma.transcript.upsert({
        where: { call_id: callId },
        update: { transcript_text: transcript },
        create: {
          call_id: callId,
          transcript_text: transcript,
          transcription_service: 'abacus_llm',
        },
      });

      // Step 7: AI Analysis
      this.logger.log(`Step 7: Analyzing transcript for call ${trackdriveCallId}`);
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
        where: { call_id: callId },
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
          call_id: callId,
          detected_triggers: analysisResult.detected_triggers,
          confidence_score: analysisResult.confidence_score,
          is_flagged: analysisResult.is_flagged,
          flag_reason: analysisResult.flag_reason,
          ai_summary: analysisResult.ai_summary,
          high_sensitivity: isHighSensitivity,
          raw_ai_response: analysisResult.raw_response,
        },
      });

      // Step 8: Flag and alert if needed
      if (analysisResult.is_flagged) {
        this.logger.log(`Call ${trackdriveCallId} FLAGGED - confidence: ${analysisResult.confidence_score}`);

        const severity = analysisResult.confidence_score >= 80 ? 'critical'
          : analysisResult.confidence_score >= 60 ? 'high'
          : analysisResult.confidence_score >= 40 ? 'medium'
          : 'low';

        const flag = await this.prisma.flag.create({
          data: {
            call_id: callId,
            affiliate_id: affiliate?.id || null,
            flag_type: 'cold_transfer',
            severity,
            details: analysisResult.flag_reason || analysisResult.ai_summary,
          },
        });

        // Update affiliate flagged count
        if (affiliate) {
          await this.prisma.affiliate.update({
            where: { id: affiliate.id },
            data: { flagged_calls: { increment: 1 } },
          });
        }

        // Send Discord alert
        const alertSent = await this.discord.sendFlaggedCallAlert({
          callId,
          trackdriveCallId,
          callerNumber,
          callerCity,
          callerState,
          affiliateName,
          campaignName,
          buyerName,
          duration,
          detectedTriggers: analysisResult.detected_triggers,
          confidenceScore: analysisResult.confidence_score,
          aiSummary: analysisResult.ai_summary,
          recordingUrl,
          isHighSensitivity,
        });

        if (alertSent) {
          await this.prisma.flag.update({
            where: { id: flag.id },
            data: { notified: true, notified_at: new Date() },
          });
        }
      }

      // Mark as analyzed
      await this.prisma.call.update({
        where: { id: callId },
        data: { status: 'analyzed' },
      });

      this.logger.log(`Call ${trackdriveCallId} processing complete`);
    } catch (error: any) {
      this.logger.error(`Call processing failed for ${trackdriveCallId}: ${error.message}`);
      await this.prisma.call.update({
        where: { id: callId },
        data: { status: 'error' },
      }).catch(() => {});
      throw error; // Re-throw for retry
    }
  }

  async getFlaggedCalls(options: {
    page?: number;
    limit?: number;
    affiliateId?: string;
    severity?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      qa_analysis: { is_flagged: true },
    };

    if (options.affiliateId) {
      where.affiliate_id = options.affiliateId;
    }

    if (options.startDate || options.endDate) {
      where.created_at = {};
      if (options.startDate) where.created_at.gte = new Date(options.startDate);
      if (options.endDate) where.created_at.lte = new Date(options.endDate);
    }

    const [calls, total] = await Promise.all([
      this.prisma.call.findMany({
        where,
        include: {
          qa_analysis: true,
          affiliate: { select: { id: true, name: true, trackdrive_id: true } },
          flags: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.call.count({ where }),
    ]);

    // Optionally filter by severity at app level
    let filtered = calls;
    if (options.severity) {
      filtered = calls.filter((c) =>
        c.flags.some((f) => f.severity === options.severity),
      );
    }

    return {
      data: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
