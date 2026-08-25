import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { N2NService } from './n2n.service.js';
import { N2NController } from './n2n.controller.js';
import { N2NApplicationService } from './n2n-application.service.js';
import { N2NApplicationController } from './n2n-application.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DiscordModule } from '../discord/discord.module.js';

@Module({
  imports: [PrismaModule, DiscordModule, ConfigModule],
  controllers: [N2NController, N2NApplicationController],
  providers: [N2NService, N2NApplicationService],
  exports: [N2NService, N2NApplicationService],
})
export class N2NModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  onModuleInit() {
    const n2nService = this.moduleRef.get(N2NService);
    const appService = this.moduleRef.get(N2NApplicationService);
    n2nService.setApplicationService(appService);
  }
}
