import { snapshotReadyPayloadSchema, userDisconnectedPayloadSchema } from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class SnapshotReadyDto extends createZodDto(snapshotReadyPayloadSchema) {}
export class UserDisconnectedDto extends createZodDto(userDisconnectedPayloadSchema) {}
