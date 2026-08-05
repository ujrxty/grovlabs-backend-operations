import { Module } from '@nestjs/common';
import { TrackDriveService } from './trackdrive.service.js';

@Module({
  providers: [TrackDriveService],
  exports: [TrackDriveService],
})
export class TrackDriveModule {}
