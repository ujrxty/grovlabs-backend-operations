import { Module } from '@nestjs/common';
import { CallsService } from './calls.service.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { DiscordModule } from '../discord/discord.module.js';

@Module({
  imports: [TrackDriveModule, TranscriptionModule, AnalysisModule, DiscordModule],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
