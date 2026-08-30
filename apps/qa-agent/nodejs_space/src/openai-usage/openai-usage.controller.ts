import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OpenAIUsageService } from './openai-usage.service.js';

@ApiTags('OpenAI Usage')
@Controller('api/openai-usage')
export class OpenAIUsageController {
  private readonly logger = new Logger(OpenAIUsageController.name);

  constructor(private readonly usageService: OpenAIUsageService) {}

  @Get()
  @ApiOperation({ summary: 'Get OpenAI API usage and budget' })
  @ApiResponse({ status: 200, description: 'Usage data returned' })
  async getUsage() {
    const [usage, budget] = await Promise.all([
      this.usageService.getUsage(),
      this.usageService.getBudget(),
    ]);

    const percentUsed = budget.limit > 0 ? Math.round((budget.used / budget.limit) * 100) : 0;

    return {
      used: `$${budget.used.toFixed(2)}`,
      remaining: `$${budget.remaining.toFixed(2)}`,
      limit: `$${budget.limit.toFixed(2)}`,
      percentUsed,
      byModel: usage.byModel,
      daily: usage.daily.slice(0, 7),
      topUpUrl: 'https://platform.openai.com/account/billing/overview',
    };
  }

  @Post('budget')
  @ApiOperation({ summary: 'Set monthly budget limit' })
  async setBudget(@Body() body: { limit: number }) {
    await this.usageService.setBudget(body.limit);
    return { success: true, limit: body.limit };
  }
}
