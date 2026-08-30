import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OpenAIUsageService } from './openai-usage.service.js';

@ApiTags('OpenAI Usage')
@Controller('api/openai-usage')
export class OpenAIUsageController {
  private readonly logger = new Logger(OpenAIUsageController.name);

  constructor(private readonly usageService: OpenAIUsageService) {}

  @Get()
  @ApiOperation({ summary: 'Get OpenAI API usage and remaining credits' })
  @ApiResponse({ status: 200, description: 'Usage data returned' })
  async getUsage() {
    const usage = await this.usageService.getUsage();
    if (!usage) {
      return { error: 'Could not fetch usage data' };
    }
    return {
      used: `$${usage.totalUsedUSD.toFixed(2)}`,
      remaining: `$${usage.remainingUSD.toFixed(2)}`,
      limit: `$${usage.hardLimitUSD.toFixed(2)}`,
      percentUsed: Math.round((usage.totalUsedUSD / usage.hardLimitUSD) * 100),
      dailyUsage: usage.dailyUsage.slice(-7), // Last 7 days
      topUpUrl: 'https://platform.openai.com/account/billing/overview',
    };
  }

  @Get('quick')
  @ApiOperation({ summary: 'Get quick stats - used, limit, remaining' })
  @ApiResponse({ status: 200, description: 'Quick stats returned' })
  async getQuickStats() {
    const stats = await this.usageService.getQuickStats();
    if (!stats) {
      return { error: 'Could not fetch usage data' };
    }
    return stats;
  }
}
