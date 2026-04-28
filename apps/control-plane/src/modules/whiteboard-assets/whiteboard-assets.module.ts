import { Module } from '@nestjs/common';
import { WhiteboardAssetsController } from './whiteboard-assets.controller.js';
import { WhiteboardAssetsService } from './whiteboard-assets.service.js';

@Module({
  controllers: [WhiteboardAssetsController],
  providers: [WhiteboardAssetsService],
  exports: [WhiteboardAssetsService],
})
export class WhiteboardAssetsModule {}
