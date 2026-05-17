import { ApiProperty } from '@nestjs/swagger';
import {
  browseRoomsQuerySchema,
  browseRoomsResponseSchema,
  changeRoomLanguageSchema,
  createRoomResponseSchema,
  createRoomSchema,
  destroyRoomResponseSchema,
  ensureCollabResponseSchema,
  joinRoomResponseSchema,
  joinRoomSchema,
  listRoomsQuerySchema,
  listRoomsResponseSchema,
  lockEditorResponseSchema,
  mediaTokenResponseSchema,
  requestRoomAiHintResponseSchema,
  requestRoomAiHintSchema,
  requestRoomAiInterviewResponseSchema,
  requestRoomAiInterviewSchema,
  roomChatMediaUploadRequestSchema,
  roomChatMediaUploadResponseSchema,
  roomDetailSchema,
  runCodeResponseSchema,
  runCodeSchema,
  submitProblemSchema,
  submitResponseSchema,
  transferRoomOwnershipResponseSchema,
  transferRoomOwnershipSchema,
  transitionRoomPhaseResponseSchema,
  transitionRoomPhaseSchema,
  unlockEditorResponseSchema,
  updateRoomParticipantResponseSchema,
  updateRoomParticipantSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class ListRoomsQueryDto extends createZodDto(listRoomsQuerySchema) {}
export class BrowseRoomsQueryDto extends createZodDto(browseRoomsQuerySchema) {}
export class BrowseRoomsResponseDto extends createZodDto(browseRoomsResponseSchema) {}
export class ChangeRoomLanguageDto extends createZodDto(changeRoomLanguageSchema) {}
export class RunCodeDto extends createZodDto(runCodeSchema) {}
export class SubmitProblemDto extends createZodDto(submitProblemSchema) {}
export class RequestRoomAiHintDto extends createZodDto(requestRoomAiHintSchema) {}
export class RoomChatMediaUploadDto extends createZodDto(roomChatMediaUploadRequestSchema) {}
export class JoinRoomDto extends createZodDto(joinRoomSchema) {}
export class TransferRoomOwnershipDto extends createZodDto(transferRoomOwnershipSchema) {}
export class UpdateRoomParticipantDto extends createZodDto(updateRoomParticipantSchema) {}
export class TransitionRoomPhaseDto extends createZodDto(transitionRoomPhaseSchema) {}
export class CreateRoomResponseDto extends createZodDto(createRoomResponseSchema) {}
export class ListRoomsResponseDto extends createZodDto(listRoomsResponseSchema) {}
export class RoomDetailDto extends createZodDto(roomDetailSchema) {}
export class DestroyRoomResponseDto extends createZodDto(destroyRoomResponseSchema) {}
export class RunCodeResponseDto extends createZodDto(runCodeResponseSchema) {}
export class SubmitCodeResponseDto extends createZodDto(submitResponseSchema) {}
export class RequestRoomAiHintResponseDto extends createZodDto(requestRoomAiHintResponseSchema) {}

export class RequestRoomAiInterviewDto extends createZodDto(requestRoomAiInterviewSchema) {}
export class RequestRoomAiInterviewResponseDto extends createZodDto(
  requestRoomAiInterviewResponseSchema,
) {}

export class GetRoomAiInterviewResultResponseDto {
  @ApiProperty({ enum: ['pending', 'ready', 'failed'] })
  status!: 'pending' | 'ready' | 'failed';

  @ApiProperty({ description: 'AI interview job ID' })
  jobId!: string;

  @ApiProperty({ required: false, description: 'AI interviewer message (when status=ready)' })
  message?: string;

  @ApiProperty({ required: false })
  followUpQuestion?: string;

  @ApiProperty({
    required: false,
    type: 'array',
    items: {
      type: 'object',
      properties: { line: { type: 'number' }, comment: { type: 'string' } },
    },
  })
  codeAnnotations?: Array<{ line: number; comment: string }>;

  @ApiProperty({ required: false, description: 'Presigned audio URL (when status=ready)' })
  audioUrl?: string;
}

export class GetRoomAiHintResultResponseDto {
  @ApiProperty({ enum: ['pending', 'ready', 'failed'] })
  status!: 'pending' | 'ready' | 'failed';

  @ApiProperty({ description: 'AI hint job ID' })
  jobId!: string;

  @ApiProperty({ required: false, description: 'Persistent hint identifier (when status=ready)' })
  hintId?: string;

  @ApiProperty({ required: false, enum: ['initial', 'follow_up'] })
  phase?: 'initial' | 'follow_up';

  @ApiProperty({ required: false, description: 'Generated hint content (when status=ready)' })
  hint?: string;

  @ApiProperty({ required: false })
  suggestedApproach?: string;

  @ApiProperty({ required: false })
  reflectionPrompt?: string;
}
export class RoomChatMediaUploadResponseDto extends createZodDto(
  roomChatMediaUploadResponseSchema,
) {}
export class JoinRoomResponseDto extends createZodDto(joinRoomResponseSchema) {}
export class TransferRoomOwnershipResponseDto extends createZodDto(
  transferRoomOwnershipResponseSchema,
) {}
export class UpdateRoomParticipantResponseDto extends createZodDto(
  updateRoomParticipantResponseSchema,
) {}
export class TransitionRoomPhaseResponseDto extends createZodDto(
  transitionRoomPhaseResponseSchema,
) {}
export class LockEditorResponseDto extends createZodDto(lockEditorResponseSchema) {}
export class UnlockEditorResponseDto extends createZodDto(unlockEditorResponseSchema) {}
export class MediaTokenResponseDto extends createZodDto(mediaTokenResponseSchema) {}
export class EnsureCollabResponseDto extends createZodDto(ensureCollabResponseSchema) {}
