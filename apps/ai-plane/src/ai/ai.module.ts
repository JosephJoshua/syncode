import { Module } from '@nestjs/common';
import { AiProcessor } from './ai.processor.js';
import { AiService } from './ai.service.js';

@Module({
  providers: [AiService, AiProcessor],
})
export class AiModule {}
