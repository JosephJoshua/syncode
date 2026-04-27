import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import {
  type BroadcastParticipantReadyRequest,
  type ChangeLanguageRequest,
  COLLAB_INTERNAL,
  type CreateDocumentRequest,
  type KickUserRequest,
  type UpdateRoomStateRequest,
} from '@syncode/contracts';
import { CollaborationService } from '../collaboration/collaboration.service.js';
import { InternalCallbackGuard } from '../common/guards/internal-callback.guard.js';

/**
 * Receives HTTP callbacks FROM other planes.
 * These endpoints are NOT exposed via nginx and require the shared
 * `X-Internal-Secret` header enforced by `InternalCallbackGuard`.
 */
@UseGuards(InternalCallbackGuard)
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

  @Post(COLLAB_INTERNAL.BROADCAST_PARTICIPANT_READY.route)
  broadcastParticipantReady(
    @Param('roomId') roomId: string,
    @Body() body: BroadcastParticipantReadyRequest,
  ) {
    this.collaborationService.broadcastParticipantReady(roomId, body.userId, body.isReady);
    return { success: true };
  }

  @Post(COLLAB_INTERNAL.CHANGE_LANGUAGE.route)
  changeLanguage(@Param('roomId') roomId: string, @Body() body: ChangeLanguageRequest) {
    return this.collaborationService.changeLanguage({ ...body, roomId });
  }
}
