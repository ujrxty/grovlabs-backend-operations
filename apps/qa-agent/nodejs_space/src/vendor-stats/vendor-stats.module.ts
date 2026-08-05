import { Module } from '@nestjs/common';
import { VendorStatsService } from './vendor-stats.service';
import { VendorStatsController } from './vendor-stats.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackDriveModule } from '../trackdrive/trackdrive.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, TrackDriveModule, TelegramModule, ConfigModule],
  controllers: [VendorStatsController],
  providers: [VendorStatsService],
  exports: [VendorStatsService],
})
export class VendorStatsModule {}
