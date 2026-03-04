import { Module } from '@nestjs/common';
import { AiProcessor } from './ai.processor';
import { AiService } from './ai.service';

@Module({
  providers: [AiService, AiProcessor],
})
export class AiModule {}
