import { Module, Global } from '@nestjs/common';
import { NtfyService } from './ntfy.service.js';

@Global()
@Module({
  providers: [NtfyService],
  exports: [NtfyService],
})
export class NtfyModule {}
