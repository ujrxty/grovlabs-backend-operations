import { Module } from '@nestjs/common';
import { StartupService } from './startup.service.js';
import { TelegramModule } from '../telegram/telegram.module.js';

@Module({
  imports: [TelegramModule],
  providers: [StartupService],
})
export class StartupModule {}