import {
  createRoomResponseSchema,
  createRoomSchema,
  destroyRoomResponseSchema,
  joinRoomResponseSchema,
  joinRoomSchema,
  listRoomsQuerySchema,
  listRoomsResponseSchema,
  roomDetailSchema,
  runCodeResponseSchema,
  runCodeSchema,
  submitProblemSchema,
  submitResultItemSchema,
  transferRoomOwnershipResponseSchema,
  transferRoomOwnershipSchema,
  transitionRoomPhaseResponseSchema,
  transitionRoomPhaseSchema,
  updateRoomParticipantResponseSchema,
  updateRoomParticipantSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class ListRoomsQueryDto extends createZodDto(listRoomsQuerySchema) {}
export class RunCodeDto extends createZodDto(runCodeSchema) {}
export class SubmitProblemDto extends createZodDto(submitProblemSchema) {}
export class JoinRoomDto extends createZodDto(joinRoomSchema) {}
export class TransferRoomOwnershipDto extends createZodDto(transferRoomOwnershipSchema) {}
export class UpdateRoomParticipantDto extends createZodDto(updateRoomParticipantSchema) {}
export class TransitionRoomPhaseDto extends createZodDto(transitionRoomPhaseSchema) {}
export class CreateRoomResponseDto extends createZodDto(createRoomResponseSchema) {}
export class ListRoomsResponseDto extends createZodDto(listRoomsResponseSchema) {}
export class RoomDetailDto extends createZodDto(roomDetailSchema) {}
export class DestroyRoomResponseDto extends createZodDto(destroyRoomResponseSchema) {}
export class RunCodeResponseDto extends createZodDto(runCodeResponseSchema) {}
export class SubmitResultItemDto extends createZodDto(submitResultItemSchema) {}
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
