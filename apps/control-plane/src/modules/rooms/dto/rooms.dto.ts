import {
  createRoomResponseSchema,
  createRoomSchema,
  destroyRoomResponseSchema,
  listRoomsQuerySchema,
  listRoomsResponseSchema,
  roomDetailSchema,
  runCodeResponseSchema,
  runCodeSchema,
  submitProblemSchema,
  submitResultItemSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateRoomDto extends createZodDto(createRoomSchema) {}
export class ListRoomsQueryDto extends createZodDto(listRoomsQuerySchema) {}
export class RunCodeDto extends createZodDto(runCodeSchema) {}
export class SubmitProblemDto extends createZodDto(submitProblemSchema) {}
export class CreateRoomResponseDto extends createZodDto(createRoomResponseSchema) {}
export class ListRoomsResponseDto extends createZodDto(listRoomsResponseSchema) {}
export class RoomDetailDto extends createZodDto(roomDetailSchema) {}
export class DestroyRoomResponseDto extends createZodDto(destroyRoomResponseSchema) {}
export class RunCodeResponseDto extends createZodDto(runCodeResponseSchema) {}
export class SubmitResultItemDto extends createZodDto(submitResultItemSchema) {}
