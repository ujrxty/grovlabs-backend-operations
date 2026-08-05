import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { BotService } from './bot.service.js';

@ApiTags('Telegram Bot')
@Controller('bot')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(private readonly botService: BotService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleWebhook(@Body() update: any) {
    // Respond immediately, process async
    this.botService.handleUpdate(update).catch(err => {
      this.logger.error(`Bot webhook error: ${err.message}`);
    });
    return { ok: true };
  }

}
