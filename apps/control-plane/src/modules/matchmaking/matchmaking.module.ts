import { Module } from '@nestjs/common';
import { RoomsModule } from '@/modules/rooms/rooms.module.js';
import { MatchmakingController } from './matchmaking.controller.js';
import { MatchmakingService } from './matchmaking.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
