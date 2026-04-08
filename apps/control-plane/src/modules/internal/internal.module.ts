import { Module } from '@nestjs/common';
import { RoomsModule } from '@/modules/rooms/rooms.module.js';
import { InternalController } from './internal.controller.js';

/**
 * Handles internal HTTP callbacks from other planes.
 */
@Module({
  imports: [RoomsModule],
  controllers: [InternalController],
})
export class InternalModule {}
