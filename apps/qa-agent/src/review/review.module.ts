import { Module } from '@nestjs/common';
import { ReviewService } from './review.service.js';
import { ReviewController } from './review.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { TranscriptionModule } from '../transcription/transcription.module.js';
import { AnalysisModule } from '../analysis/analysis.module.js';
import { TelegramModule } from '../telegram/telegram.module.js';

@Module({
  imports: [
    PrismaModule,
    TrackDriveModule,
    TranscriptionModule,
    AnalysisModule,
    TelegramModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
