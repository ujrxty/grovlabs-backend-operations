import { Module, Global } from '@nestjs/common';
import { QASettingsController } from './qa-settings.controller.js';
import { QASettingsService } from './qa-settings.service.js';

@Global()
@Module({
  controllers: [QASettingsController],
  providers: [QASettingsService],
  exports: [QASettingsService],
})
export class QASettingsModule {}
