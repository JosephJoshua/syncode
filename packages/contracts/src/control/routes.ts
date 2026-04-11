import type { z } from 'zod';
import { defineRoute } from '../route-utils.js';
import type {
  accessTokenResponseSchema,
  loginResponseSchema,
  loginSchema,
  registerResponseSchema,
  registerSchema,
} from './auth.js';
import type { listBookmarksResponseSchema } from './bookmarks.js';
import type {
  executionDetailsResponseSchema,
  executionResultResponseSchema,
  jobStatusResponseSchema,
} from './execution.js';
import type { healthCheckResponseSchema } from './health.js';
import type {
  problemDetailSchema,
  problemsListResponseSchema,
  problemsTagsResponseSchema,
} from './problems.js';
import type {
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
} from './rooms.js';
import type {
  listSessionsQuerySchema,
  sessionDetailSchema,
  sessionHistoryResponseSchema,
} from './sessions.js';
import type {
  avatarUploadUrlResponseSchema,
  publicUserProfileResponseSchema,
  updateUserSchema,
  userProfileResponseSchema,
  userQuotasResponseSchema,
} from './users.js';

export const CONTROL_API = {
  AUTH: {
    REGISTER: defineRoute<z.infer<typeof registerSchema>, z.infer<typeof registerResponseSchema>>()(
      'auth/register',
      'POST',
    ),
    LOGIN: defineRoute<z.infer<typeof loginSchema>, z.infer<typeof loginResponseSchema>>()(
      'auth/login',
      'POST',
    ),
    REFRESH: defineRoute<void, z.infer<typeof accessTokenResponseSchema>>()('auth/refresh', 'POST'),
    LOGOUT: defineRoute<void, void>()('auth/logout', 'POST'),
  },
  USERS: {
    PROFILE: defineRoute<void, z.infer<typeof userProfileResponseSchema>>()('users/me', 'GET'),
    QUOTAS: defineRoute<void, z.infer<typeof userQuotasResponseSchema>>()('users/me/quotas', 'GET'),
    GET_BY_ID: defineRoute<void, z.infer<typeof publicUserProfileResponseSchema>>()(
      'users/:id',
      'GET',
    ),
    UPDATE: defineRoute<
      z.infer<typeof updateUserSchema>,
      z.infer<typeof userProfileResponseSchema>
    >()('users/me', 'PATCH'),
    DELETE: defineRoute<void, void>()('users/me', 'DELETE'),
    AVATAR_UPLOAD_URL: defineRoute<void, z.infer<typeof avatarUploadUrlResponseSchema>>()(
      'users/me/avatar/upload-url',
      'POST',
    ),
    AVATAR_CONFIRM: defineRoute<void, z.infer<typeof userProfileResponseSchema>>()(
      'users/me/avatar/confirm',
      'POST',
    ),
    AVATAR_DELETE: defineRoute<void, void>()('users/me/avatar', 'DELETE'),
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
    JOIN: defineRoute<z.infer<typeof joinRoomSchema>, z.infer<typeof joinRoomResponseSchema>>()(
      'rooms/:id/join',
      'POST',
    ),
    TRANSFER_OWNERSHIP: defineRoute<
      z.infer<typeof transferRoomOwnershipSchema>,
      z.infer<typeof transferRoomOwnershipResponseSchema>
    >()('rooms/:id/ownership/transfer', 'POST'),
    UPDATE_PARTICIPANT: defineRoute<
      z.infer<typeof updateRoomParticipantSchema>,
      z.infer<typeof updateRoomParticipantResponseSchema>
    >()('rooms/:id/participants/:participantUserId', 'PATCH'),
    DESTROY: defineRoute<void, z.infer<typeof destroyRoomResponseSchema>>()('rooms/:id', 'DELETE'),
    RUN: defineRoute<z.infer<typeof runCodeSchema>, z.infer<typeof runCodeResponseSchema>>()(
      'rooms/:id/run',
      'POST',
    ),
    SUBMIT: defineRoute<
      z.infer<typeof submitProblemSchema>,
      z.infer<typeof submitResultItemSchema>[]
    >()('rooms/:id/submit', 'POST'),
    TRANSITION_PHASE: defineRoute<
      z.infer<typeof transitionRoomPhaseSchema>,
      z.infer<typeof transitionRoomPhaseResponseSchema>
    >()('rooms/:id/control/transition', 'POST'),
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
    GET_SUBMISSION_DETAILS: defineRoute<void, z.infer<typeof executionDetailsResponseSchema>>()(
      'submissions/:submissionId',
      'GET',
    ),
  },
  PROBLEMS: {
    LIST: defineRoute<void, z.infer<typeof problemsListResponseSchema>>()('problems', 'GET'),
    GET_BY_ID: defineRoute<void, z.infer<typeof problemDetailSchema>>()('problems/:id', 'GET'),
    TAGS: defineRoute<void, z.infer<typeof problemsTagsResponseSchema>>()('problems/tags', 'GET'),
    CREATE: defineRoute<void, void>()('problems', 'POST'),
    DELETE: defineRoute<void, void>()('problems/:id', 'DELETE'),
  },
  BOOKMARKS: {
    LIST: defineRoute<void, z.infer<typeof listBookmarksResponseSchema>>()(
      'users/me/bookmarks',
      'GET',
    ),
    ADD: defineRoute<void, void>()('users/me/bookmarks/:problemId', 'PUT'),
    REMOVE: defineRoute<void, void>()('users/me/bookmarks/:problemId', 'DELETE'),
  },
  SESSIONS: {
    LIST: defineRoute<
      z.infer<typeof listSessionsQuerySchema>,
      z.infer<typeof sessionHistoryResponseSchema>
    >()('sessions', 'GET'),
    GET: defineRoute<void, z.infer<typeof sessionDetailSchema>>()('sessions/:id', 'GET'),
    DELETE: defineRoute<void, void>()('sessions/:id', 'DELETE'),
  },
  HEALTH: defineRoute<void, z.infer<typeof healthCheckResponseSchema>>()('health', 'GET'),
};
