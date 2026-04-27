import {
  authorizeJoinRequestSchema,
  participantHeartbeatRequestSchema,
  persistDocSnapshotPayloadSchema,
  snapshotReadyPayloadSchema,
  userDisconnectedPayloadSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class SnapshotReadyDto extends createZodDto(snapshotReadyPayloadSchema) {}
export class UserDisconnectedDto extends createZodDto(userDisconnectedPayloadSchema) {}
export class ParticipantHeartbeatDto extends createZodDto(participantHeartbeatRequestSchema) {}
export class AuthorizeJoinDto extends createZodDto(authorizeJoinRequestSchema) {}
export class PersistDocSnapshotDto extends createZodDto(persistDocSnapshotPayloadSchema) {}
