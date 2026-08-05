import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller.js';

@Module({
  controllers: [AffiliatesController],
})
export class AffiliatesModule {}
