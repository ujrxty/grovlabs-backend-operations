import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { SalesQaService } from './sales-qa.service.js';
import { SalesQaController } from './sales-qa.controller.js';

@Module({
  imports: [ConfigModule, TrackDriveModule],
  controllers: [SalesQaController],
  providers: [SalesQaService],
  exports: [SalesQaService],
})
export class SalesQaModule {}
