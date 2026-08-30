import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COLD_TRANSFER_TRIGGERS,
  HIGH_SENSITIVITY_CONFIDENCE_THRESHOLD,
  NORMAL_CONFIDENCE_THRESHOLD,
} from '../config/constants.js';
import { OpenAIUsageService } from '../openai-usage/openai-usage.service.js';

export interface AnalysisResult {
  detected_triggers: string[];
  confidence_score: number;
  is_flagged: boolean;
  flag_reason: string | null;
  ai_summary: string;
  raw_response: any;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usageService: OpenAIUsageService,
  ) {}

  async analyzeTranscript(
    transcript: string,
    callContext: {
      callId: string;
      affiliateName?: string;
      campaignName?: string;
      duration?: number;
      isHighSensitivity?: boolean;
    },
  ): Promise<AnalysisResult> {
    this.logger.log(`Analyzing transcript for call ${callContext.callId}`);

    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    const sensitivityNote = callContext.isHighSensitivity
      ? `\n\nIMPORTANT: This affiliate is under HIGH-SENSITIVITY MONITORING. Apply stricter evaluation criteria. Flag calls even with lower confidence indicators. Any hint of cold transfer patterns should be flagged.`
      : '';

    const prompt = `You are a QA analyst for GrovLabs Inc, a performance marketing company that brokers INBOUND call campaigns. Your ONLY job is to detect "cold transfers" — outbound calls from marketing vendors/affiliates that are fraudulently transferred into our inbound-only DID (phone number) to appear as if the consumer called us.

CRITICAL CONTEXT — WHAT IS NORMAL FOR THESE CAMPAIGNS:
- These are INBOUND calls. Consumers see our ads, visit websites, or find our number and CALL US. This is normal and expected.
- Buyer-side IVRs are NORMAL. Messages like "Press 1 to continue", "Enter your zip code", "Please hold while we connect you", "This call may be recorded for quality assurance" — these are buyer compliance IVRs and are NOT suspicious. Do NOT flag these.
- Background noise, call quality issues, brief hold music, and IVR prompts are all normal for inbound call campaigns.
- Short calls where consumers hang up quickly, get disconnected, or don't engage are NOT cold transfers — they are just bad leads or tire kickers. Do NOT flag these unless the consumer explicitly says they were transferred or called by someone.
- A consumer asking "What company is this?" alone is NOT a flag — inbound callers often don't remember which ad they clicked.
- Calls where the consumer is genuinely shopping for quotes (auto insurance, home insurance, etc.) are NORMAL even if they sound confused or distracted.

WHAT YOU ARE LOOKING FOR — ACTUAL COLD TRANSFER INDICATORS:
The ONLY thing we care about is evidence that a marketing vendor/affiliate CALLED the consumer outbound and then transferred them into our inbound line. Look for these EXPLICIT statements from the consumer:

HIGH CONFIDENCE (consumer explicitly says they were transferred/called):
${COLD_TRANSFER_TRIGGERS.primary.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

MEDIUM CONFIDENCE (consumer seems confused about being on the call in a way that suggests transfer):
${COLD_TRANSFER_TRIGGERS.secondary.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

WHAT TO FLAG:
- Consumer EXPLICITLY says someone called them, transferred them, or they didn't initiate the call
- Consumer references speaking to another person/agent before being connected
- Consumer asks to be transferred BACK to whoever they were talking to before
- Consumer says they never requested a quote, never filled out a form, never gave their information
- Consumer says "you called me" or "I got a call from you guys" or "someone sent me here"

WHAT NOT TO FLAG:
- Buyer IVR prompts (press 1, enter zip, hold music, compliance recordings)
- Short or disconnected calls without explicit transfer language
- Normal inbound caller confusion ("what's this about?" without saying they were called/transferred)
- Background noise, call quality issues
- Spam/robocalls that don't involve a human vendor transferring

CALL CONTEXT:
- Call ID: ${callContext.callId}
- Affiliate: ${callContext.affiliateName || 'Unknown'}
- Campaign: ${callContext.campaignName || 'Unknown'}
- Duration: ${callContext.duration || 0} seconds${sensitivityNote}

TRANSCRIPT:
${transcript}

Analyze ONLY for evidence of cold transfers (vendor calling consumer outbound and transferring into our inbound line). Respond in JSON format:
- "detected_triggers": array of EXACT quotes from the transcript that indicate a cold transfer (empty array if none found)
- "confidence_score": number 0-100. Only score above 50 if there is EXPLICIT language from the consumer indicating they were called/transferred. IVRs, background noise, short calls = score under 15.
- "is_flagged": boolean - true ONLY if you have genuine evidence of a cold transfer. When in doubt, do NOT flag.
- "flag_reason": string explaining the specific cold transfer evidence (or null if not flagged)
- "ai_summary": brief 1-2 sentence summary of the call

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;

      // Log GPT-4o usage
      if (data?.usage) {
        await this.usageService.logUsage(
          'gpt-4o',
          data.usage.prompt_tokens || 0,
          data.usage.completion_tokens || 0,
        );
      }

      if (!content) {
        throw new Error('Empty response from LLM API');
      }

      const parsed = JSON.parse(content);

      const confidenceThreshold = callContext.isHighSensitivity
        ? HIGH_SENSITIVITY_CONFIDENCE_THRESHOLD
        : NORMAL_CONFIDENCE_THRESHOLD;

      // Override flagging based on confidence threshold
      const isFlagged =
        parsed.is_flagged || parsed.confidence_score >= confidenceThreshold;

      const result: AnalysisResult = {
        detected_triggers: parsed.detected_triggers || [],
        confidence_score: parsed.confidence_score || 0,
        is_flagged: isFlagged,
        flag_reason: isFlagged
          ? parsed.flag_reason || `Confidence score ${parsed.confidence_score} exceeds threshold ${confidenceThreshold}`
          : null,
        ai_summary: parsed.ai_summary || '',
        raw_response: parsed,
      };

      this.logger.log(
        `Analysis complete for call ${callContext.callId}: flagged=${result.is_flagged}, confidence=${result.confidence_score}`,
      );
      return result;
    } catch (error: any) {
      this.logger.error(`Analysis failed for call ${callContext.callId}: ${error.message}`);
      throw error;
    }
  }
}
