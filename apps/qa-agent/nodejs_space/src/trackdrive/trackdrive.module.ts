import { Module } from '@nestjs/common';
import { TrackDriveService } from './trackdrive.service.js';
import { CallGridService } from './callgrid.service.js';

@Module({
  providers: [TrackDriveService, CallGridService],
  exports: [TrackDriveService, CallGridService],
})
export class TrackDriveModule {}
