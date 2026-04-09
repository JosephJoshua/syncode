import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  COLLAB_INTERNAL,
  type CreateDocumentRequest,
  type KickUserRequest,
  type NotifyPhaseChangeRequest,
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

  @Post(COLLAB_INTERNAL.NOTIFY_PHASE_CHANGE.route)
  async notifyPhaseChange(@Param('roomId') roomId: string, @Body() body: NotifyPhaseChangeRequest) {
    await this.collaborationService.notifyPhaseChange(roomId, body.newPhase);
    return { success: true };
  }

  @Get(COLLAB_INTERNAL.HEALTH.route)
  health() {
    return { status: 'ok' as const };
  }
}
