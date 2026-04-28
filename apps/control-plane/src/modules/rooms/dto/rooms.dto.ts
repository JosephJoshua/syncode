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
