import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface UsageData {
  totalUsedUSD: number;
  dailyUsage: { date: string; cost: number }[];
  hardLimitUSD: number;
  softLimitUSD: number;
  remainingUSD: number;
}

@Injectable()
export class OpenAIUsageService {
  private readonly logger = new Logger(OpenAIUsageService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY', '');
  }

  async getUsage(): Promise<UsageData | null> {
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY not set');
      return null;
    }

    try {
      // Get current billing period dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = now.toISOString().split('T')[0];
      const startDate = startOfMonth.toISOString().split('T')[0];

      // Fetch usage data from OpenAI
      const usageResponse = await axios.get(
        `https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      );

      // Fetch subscription/limits
      const subResponse = await axios.get(
        'https://api.openai.com/v1/dashboard/billing/subscription',
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        }
      );

      const usage = usageResponse.data;
      const subscription = subResponse.data;

      const totalUsedCents = usage.total_usage || 0;
      const totalUsedUSD = totalUsedCents / 100;
      const hardLimitUSD = subscription.hard_limit_usd || 0;
      const softLimitUSD = subscription.soft_limit_usd || 0;

      // Daily breakdown
      const dailyUsage = (usage.daily_costs || []).map((day: any) => ({
        date: day.timestamp ? new Date(day.timestamp * 1000).toISOString().split('T')[0] : 'unknown',
        cost: (day.line_items || []).reduce((sum: number, item: any) => sum + (item.cost || 0), 0) / 100,
      }));

      return {
        totalUsedUSD,
        dailyUsage,
        hardLimitUSD,
        softLimitUSD,
        remainingUSD: hardLimitUSD - totalUsedUSD,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch OpenAI usage: ${error.message}`);
      return null;
    }
  }

  async getQuickStats(): Promise<{ used: number; limit: number; remaining: number } | null> {
    const usage = await this.getUsage();
    if (!usage) return null;

    return {
      used: Math.round(usage.totalUsedUSD * 100) / 100,
      limit: usage.hardLimitUSD,
      remaining: Math.round(usage.remainingUSD * 100) / 100,
    };
  }
}
