import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  COLLAB_INTERNAL,
  type CreateDocumentRequest,
  type KickUserRequest,
  type UpdateRoomStateRequest,
} from '@syncode/contracts';
import { CollaborationService } from '../collaboration/collaboration.service.js';

@Controller()
export class InternalController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Post(COLLAB_INTERNAL.CREATE_DOCUMENT.route)
  createDocument(@Body() body: CreateDocumentRequest) {
    return this.collaborationService.createDocument(body);
  }

  @Delete(COLLAB_INTERNAL.DESTROY_DOCUMENT.route)
  destroyDocument(@Param('roomId') roomId: string) {
    return this.collaborationService.destroyDocument(roomId);
  }

  @Post(COLLAB_INTERNAL.KICK_USER.route)
  kickUser(@Param('roomId') roomId: string, @Body() body: KickUserRequest) {
    return this.collaborationService.kickUser(roomId, body);
  }

  @Post(COLLAB_INTERNAL.UPDATE_ROOM_STATE.route)
  updateRoomState(@Param('roomId') roomId: string, @Body() body: UpdateRoomStateRequest) {
    return this.collaborationService.updateRoomState({ ...body, roomId });
  }

  @Get(COLLAB_INTERNAL.HEALTH.route)
  health() {
    return { status: 'ok' as const };
  }
}
