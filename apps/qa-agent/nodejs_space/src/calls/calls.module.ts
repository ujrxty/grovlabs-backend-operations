import { Module } from '@nestjs/common';
import { CallsService } from './calls.service.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';

@Module({
  imports: [TrackDriveModule, TranscriptionModule, AnalysisModule, TelegramModule],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
