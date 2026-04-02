import type { z } from 'zod';
import { defineRoute } from '../route-utils.js';
import type {
  accessTokenResponseSchema,
  loginResponseSchema,
  loginSchema,
  registerSchema,
} from './auth.js';
import type { executionResultResponseSchema, jobStatusResponseSchema } from './execution.js';
import type { healthCheckResponseSchema } from './health.js';
import type {
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
} from './rooms.js';
import type { updateUserSchema, userProfileResponseSchema } from './users.js';

export const CONTROL_API = {
  AUTH: {
    REGISTER: defineRoute<
      z.infer<typeof registerSchema>,
      z.infer<typeof accessTokenResponseSchema>
    >()('auth/register', 'POST'),
    LOGIN: defineRoute<z.infer<typeof loginSchema>, z.infer<typeof loginResponseSchema>>()(
      'auth/login',
      'POST',
    ),
    REFRESH: defineRoute<void, z.infer<typeof accessTokenResponseSchema>>()('auth/refresh', 'POST'),
  },
  USERS: {
    PROFILE: defineRoute<void, z.infer<typeof userProfileResponseSchema>>()('users/me', 'GET'),
    GET_BY_ID: defineRoute<void, z.infer<typeof userProfileResponseSchema>>()('users/:id', 'GET'),
    UPDATE: defineRoute<
      z.infer<typeof updateUserSchema>,
      z.infer<typeof userProfileResponseSchema>
    >()('users/me', 'PATCH'),
    DELETE: defineRoute<void, void>()('users/me', 'DELETE'),
  },
  ROOMS: {
    CREATE: defineRoute<
      z.infer<typeof createRoomSchema>,
      z.infer<typeof createRoomResponseSchema>
    >()('rooms', 'POST'),
    LIST: defineRoute<
      z.infer<typeof listRoomsQuerySchema>,
      z.infer<typeof listRoomsResponseSchema>
    >()('rooms', 'GET'),
    GET: defineRoute<void, z.infer<typeof roomDetailSchema>>()('rooms/:id', 'GET'),
    DESTROY: defineRoute<void, z.infer<typeof destroyRoomResponseSchema>>()('rooms/:id', 'DELETE'),
    RUN: defineRoute<z.infer<typeof runCodeSchema>, z.infer<typeof runCodeResponseSchema>>()(
      'rooms/:id/run',
      'POST',
    ),
    SUBMIT: defineRoute<
      z.infer<typeof submitProblemSchema>,
      z.infer<typeof submitResultItemSchema>[]
    >()('rooms/:id/submit', 'POST'),
  },
  EXECUTION: {
    GET_RESULT: defineRoute<
      void,
      z.infer<typeof executionResultResponseSchema> | z.infer<typeof jobStatusResponseSchema>
    >()('execution/:jobId', 'GET'),
    GET_STATUS: defineRoute<void, z.infer<typeof jobStatusResponseSchema>>()(
      'execution/:jobId/status',
      'GET',
    ),
  },
  PROBLEMS: {
    LIST: defineRoute<void, void>()('problems', 'GET'),
    GET_BY_ID: defineRoute<void, void>()('problems/:id', 'GET'),
    CREATE: defineRoute<void, void>()('problems', 'POST'),
    DELETE: defineRoute<void, void>()('problems/:id', 'DELETE'),
  },
  HEALTH: defineRoute<void, z.infer<typeof healthCheckResponseSchema>>()('health', 'GET'),
};
