import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';

/**
 * Handles internal HTTP callbacks from other planes.
 */
@Module({
  controllers: [InternalController],
})
export class InternalModule {}
