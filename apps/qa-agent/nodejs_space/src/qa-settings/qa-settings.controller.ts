import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { QASettingsService } from './qa-settings.service.js';

@ApiTags('QA Settings')
@Controller('api/qa-settings')
export class QASettingsController {
  private readonly logger = new Logger(QASettingsController.name);

  constructor(private readonly settingsService: QASettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get QA settings' })
  @ApiResponse({ status: 200, description: 'QA settings' })
  async getSettings() {
    const settings = await this.settingsService.getSettings();
    return { settings };
  }

  @Post()
  @ApiOperation({ summary: 'Update QA settings' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiResponse({ status: 200, description: 'Settings saved' })
  async saveSettings(@Body() body: { settings: any }) {
    await this.settingsService.saveSettings(body.settings);
    return { success: true, message: 'QA settings saved' };
  }
}
