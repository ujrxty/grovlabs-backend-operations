import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// OpenAI pricing per 1K tokens (as of 2024)
const PRICING = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'whisper-1': { input: 0.006, output: 0 }, // per minute, not tokens
};

export interface UsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}

@Injectable()
export class OpenAIUsageService {
  private readonly logger = new Logger(OpenAIUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logUsage(model: string, inputTokens: number, outputTokens: number, audioMinutes?: number): Promise<void> {
    const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gpt-4o'];

    let cost: number;
    if (model === 'whisper-1' && audioMinutes) {
      cost = audioMinutes * pricing.input;
    } else {
      cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
    }

    try {
      await this.prisma.$executeRaw`
        INSERT INTO openai_usage (model, input_tokens, output_tokens, cost, created_at)
        VALUES (${model}, ${inputTokens}, ${outputTokens}, ${cost}, NOW())
      `;
    } catch (error: any) {
      this.logger.warn(`Failed to log usage: ${error.message}`);
    }
  }

  async getUsage(startDate?: Date, endDate?: Date): Promise<{
    totalCost: number;
    byModel: Record<string, { cost: number; calls: number }>;
    daily: { date: string; cost: number }[];
  }> {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate || new Date();

    try {
      // Total and by model
      const byModel = await this.prisma.$queryRaw<{ model: string; total_cost: number; call_count: bigint }[]>`
        SELECT model, SUM(cost) as total_cost, COUNT(*) as call_count
        FROM openai_usage
        WHERE created_at >= ${start} AND created_at <= ${end}
        GROUP BY model
      `;

      // Daily breakdown
      const daily = await this.prisma.$queryRaw<{ day: Date; total_cost: number }[]>`
        SELECT DATE(created_at) as day, SUM(cost) as total_cost
        FROM openai_usage
        WHERE created_at >= ${start} AND created_at <= ${end}
        GROUP BY DATE(created_at)
        ORDER BY day DESC
        LIMIT 30
      `;

      const modelStats: Record<string, { cost: number; calls: number }> = {};
      let totalCost = 0;

      for (const row of byModel) {
        modelStats[row.model] = {
          cost: Number(row.total_cost) || 0,
          calls: Number(row.call_count) || 0,
        };
        totalCost += Number(row.total_cost) || 0;
      }

      return {
        totalCost: Math.round(totalCost * 100) / 100,
        byModel: modelStats,
        daily: daily.map(d => ({
          date: d.day.toISOString().split('T')[0],
          cost: Math.round(Number(d.total_cost) * 100) / 100,
        })),
      };
    } catch (error: any) {
      this.logger.error(`Failed to get usage: ${error.message}`);
      return { totalCost: 0, byModel: {}, daily: [] };
    }
  }

  async getBudget(): Promise<{ limit: number; used: number; remaining: number }> {
    try {
      const result = await this.prisma.$queryRaw<{ settings_json: string }[]>`
        SELECT settings_json FROM system_settings WHERE key = 'openai_budget' LIMIT 1
      `;

      const budget = result[0]?.settings_json ? JSON.parse(result[0].settings_json) : { limit: 100 };
      const usage = await this.getUsage();

      return {
        limit: budget.limit || 100,
        used: usage.totalCost,
        remaining: Math.max(0, (budget.limit || 100) - usage.totalCost),
      };
    } catch {
      return { limit: 100, used: 0, remaining: 100 };
    }
  }

  async setBudget(limit: number): Promise<void> {
    const json = JSON.stringify({ limit });
    await this.prisma.$executeRaw`
      INSERT INTO system_settings (key, settings_json, updated_at)
      VALUES ('openai_budget', ${json}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET settings_json = ${json}::jsonb, updated_at = NOW()
    `;
  }
}
