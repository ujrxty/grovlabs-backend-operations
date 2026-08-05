import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TrackDriveModule } from '../trackdrive/trackdrive.module.js';
import { NonConversionQaService } from './non-conversion-qa.service.js';
import { NonConversionQaController } from './non-conversion-qa.controller.js';

@Module({
  imports: [ConfigModule, TrackDriveModule],
  controllers: [NonConversionQaController],
  providers: [NonConversionQaService],
  exports: [NonConversionQaService],
})
export class NonConversionQaModule {}
