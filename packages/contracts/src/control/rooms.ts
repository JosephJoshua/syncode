import {
  JOINABLE_ROLES,
  PROBLEM_DIFFICULTIES,
  ROOM_MODES,
  ROOM_ROLES,
  ROOM_STATUSES,
  SUPPORTED_LANGUAGES,
} from '@syncode/shared';
import { z } from 'zod';
import { paginationQuerySchema, paginationSchema } from './pagination.js';

export const roomConfigSchema = z.object({
  maxParticipants: z
    .number()
    .int()
    .min(2)
    .max(8)
    .default(2)
    .describe('Maximum number of participants'),
  maxDuration: z.number().int().positive().default(120).describe('Duration in minutes'),
  isPrivate: z.boolean().default(true).describe('Requires invite code to join'),
});

export type RoomConfig = z.infer<typeof roomConfigSchema>;

export const createRoomSchema = z
  .object({
    mode: z
      .enum(ROOM_MODES)
      .describe('Room mode')
      .meta({ examples: ['peer'] }),
    name: z
      .string()
      .max(100)
      .optional()
      .describe('Optional room name')
      .meta({ examples: ['Mock Interview #1'] }),
    problemId: z
      .uuid()
      .optional()
      .describe('Optional pre-selected problem')
      .meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
    language: z
      .enum(SUPPORTED_LANGUAGES)
      .optional()
      .describe('Programming language')
      .meta({ examples: ['python'] }),
    config: roomConfigSchema
      .optional()
      .default({ maxParticipants: 2, maxDuration: 120, isPrivate: true })
      .describe('Room configuration with defaults'),
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const runCodeSchema = z
  .object({
    language: z
      .enum(SUPPORTED_LANGUAGES)
      .describe('Programming language')
      .meta({ examples: ['python'] }),
    code: z
      .string()
      .min(1)
      .describe('Source code to execute')
      .meta({ examples: ['print("Hello, World!")'] }),
    stdin: z
      .string()
      .optional()
      .describe('Standard input for the program')
      .meta({ examples: ['42'] }),
    timeoutMs: z
      .number()
      .positive()
      .optional()
      .describe('Execution timeout in milliseconds')
      .meta({ examples: [30000] }),
    memoryMb: z
      .number()
      .positive()
      .optional()
      .describe('Memory limit in megabytes')
      .meta({ examples: [256] }),
  })
  .strict();

export type RunCodeInput = z.infer<typeof runCodeSchema>;

export const submitProblemSchema = runCodeSchema
  .omit({ stdin: true, timeoutMs: true, memoryMb: true })
  .strict();

export type SubmitProblemInput = z.infer<typeof submitProblemSchema>;

export const submitResponseSchema = z.object({
  submissionId: z
    .uuid()
    .describe('Submission ID for polling results via GET /submissions/:submissionId')
    .meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
});

export type SubmitResponse = z.infer<typeof submitResponseSchema>;

const roomBaseFields = {
  roomId: z.uuid().describe('Room identifier'),
  roomCode: z
    .string()
    .describe('6-char invite code')
    .meta({ examples: ['A3K7M2'] }),
  name: z.string().nullable().describe('Room name'),
  status: z.enum(ROOM_STATUSES).describe('Room status'),
  mode: z.enum(ROOM_MODES).describe('Room mode'),
  hostId: z.uuid().describe('Host user ID'),
  language: z.enum(SUPPORTED_LANGUAGES).nullable().describe('Programming language'),
  createdAt: z.iso.datetime().describe('ISO 8601 creation timestamp'),
};

export const createRoomResponseSchema = z.object({
  ...roomBaseFields,
  problemId: z.uuid().nullable().describe('Pre-selected problem'),
  config: roomConfigSchema.required().describe('Room configuration'),
  collabCreated: z.boolean().describe('Collab-plane integration status'),
  mediaCreated: z.boolean().describe('LiveKit integration status'),
});

export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

export const destroyRoomResponseSchema = z.object({
  roomId: z
    .string()
    .describe('Destroyed room identifier')
    .meta({ examples: ['room-abc-123'] }),
  finalSnapshot: z
    .array(z.number())
    .optional()
    .describe('Final Yjs CRDT snapshot of the document (binary, serialized as JSON array of bytes)')
    .meta({ examples: [[1, 5, 163, 230, 0, 2]] }),
  collabDeleted: z
    .boolean()
    .describe('Whether the collab document was destroyed')
    .meta({ examples: [true] }),
  mediaDeleted: z
    .boolean()
    .describe('Whether the media room was deleted')
    .meta({ examples: [true] }),
});

export type DestroyRoomResponse = z.infer<typeof destroyRoomResponseSchema>;

export const transferRoomOwnershipSchema = z
  .object({
    targetUserId: z.uuid().describe('Participant user ID to become the new host'),
  })
  .strict();

export type TransferRoomOwnershipInput = z.infer<typeof transferRoomOwnershipSchema>;

export const transferRoomOwnershipResponseSchema = z.object({
  roomId: z.uuid().describe('Room identifier'),
  previousHostId: z.uuid().describe('Previous host user ID'),
  currentHostId: z.uuid().describe('Current host user ID'),
  transferredAt: z.iso.datetime().describe('ISO 8601 ownership transfer timestamp'),
  transferredBy: z.uuid().describe('User ID that initiated the transfer'),
});

export type TransferRoomOwnershipResponse = z.infer<typeof transferRoomOwnershipResponseSchema>;

export const runCodeResponseSchema = z.object({
  jobId: z
    .string()
    .describe('Job ID for polling execution result via GET /execution/:jobId')
    .meta({ examples: ['exec-job-abc-123'] }),
});

export type RunCodeResponse = z.infer<typeof runCodeResponseSchema>;

// ── List rooms ─────────────────────────────────────────────────────

export const ROOMS_SORT_BY_OPTIONS = ['createdAt', 'status'] as const;

export const listRoomsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ROOM_STATUSES).optional().describe('Filter by room status'),
  mode: z.enum(ROOM_MODES).optional().describe('Filter by room mode'),
  sortBy: z.enum(ROOMS_SORT_BY_OPTIONS).default('createdAt').describe('Sort field'),
});

export type ListRoomsQuery = z.infer<typeof listRoomsQuerySchema>;

export const roomSummarySchema = z.object({
  ...roomBaseFields,
  myRole: z.enum(ROOM_ROLES).describe('Current user role in this room'),
  problemTitle: z.string().nullable().describe('Problem title'),
  participantCount: z.number().int().describe('Number of active participants'),
});

export type RoomSummary = z.infer<typeof roomSummarySchema>;

export const listRoomsResponseSchema = z.object({
  data: z.array(roomSummarySchema),
  pagination: paginationSchema,
});

export type ListRoomsResponse = z.infer<typeof listRoomsResponseSchema>;

export const roomParticipantSummarySchema = z.object({
  userId: z.uuid().describe('Participant user ID'),
  username: z.string().describe('Username'),
  displayName: z.string().nullable().describe('Display name'),
  avatarUrl: z.string().nullable().describe('Avatar URL'),
  role: z.enum(ROOM_ROLES).describe('Participant role'),
  isActive: z.boolean().describe('Whether the participant is currently active in the room'),
  isReady: z.boolean().describe('Whether the participant has marked themselves as ready'),
  joinedAt: z.iso.datetime().describe('ISO 8601 join timestamp'),
});

export type RoomParticipantSummary = z.infer<typeof roomParticipantSummarySchema>;

export const roomDetailSchema = z.object({
  ...roomBaseFields,
  problemId: z.uuid().nullable().describe('Pre-selected problem'),
  config: roomConfigSchema.required().describe('Room configuration'),
  participants: z.array(roomParticipantSummarySchema).describe('Room participants'),
  myRole: z.enum(ROOM_ROLES).describe('Current user role'),
  myCapabilities: z.array(z.string()).describe('Resolved room capabilities for current user'),
  currentPhaseStartedAt: z.iso.datetime().nullable().describe('When the current phase started'),
  timerPaused: z.boolean().describe('Whether the timer is paused'),
  elapsedMs: z.number().int().describe('Total elapsed coding time in ms'),
  editorLocked: z.boolean().describe('Whether the editor is locked'),
  collabToken: z
    .string()
    .optional()
    .describe(
      'Collab-plane WebSocket auth token (present for active participants in non-finished rooms)',
    ),
  collabUrl: z.string().optional().describe('Collab-plane WebSocket URL'),
});

export type RoomDetail = z.infer<typeof roomDetailSchema>;

export const joinRoomSchema = z
  .object({
    roomCode: z
      .string()
      .length(6)
      .optional()
      .describe('6-char invite code (required for private rooms, optional for public rooms)')
      .meta({ examples: ['A3K7M2'] }),
    requestedRole: z.enum(JOINABLE_ROLES).optional().describe('Requested role in the room'),
  })
  .strict();

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const ROLE_ASSIGNMENT_REASONS = ['requested', 'auto-assigned', 'fallback-observer'] as const;

export type RoleAssignmentReason = (typeof ROLE_ASSIGNMENT_REASONS)[number];

export const joinRoomResponseSchema = z.object({
  room: roomDetailSchema.describe('Full room detail after joining'),
  assignedRole: z.enum(ROOM_ROLES).describe('The role assigned to the joining user'),
  requestedRole: z
    .enum(JOINABLE_ROLES)
    .nullable()
    .describe('The role requested by the joining user, if any'),
  assignmentReason: z
    .enum(ROLE_ASSIGNMENT_REASONS)
    .describe('How the final assigned role was chosen'),
  myCapabilities: z.array(z.string()).describe('Resolved room capabilities for assigned role'),
  collabToken: z.string().describe('Yjs auth token for collab-plane WebSocket'),
  collabUrl: z.string().describe('Collab-plane WebSocket URL'),
});

export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

export const updateRoomParticipantSchema = z
  .object({
    role: z.enum(ROOM_ROLES).describe('Updated participant role'),
  })
  .strict();

export type UpdateRoomParticipantInput = z.infer<typeof updateRoomParticipantSchema>;

export const updateRoomParticipantResponseSchema = z.object({
  room: roomDetailSchema.describe('Full room detail after reassignment'),
  updatedUserId: z.uuid().describe('Participant whose role was updated'),
  previousRole: z.enum(ROOM_ROLES).describe('Participant role before the update'),
  currentRole: z.enum(ROOM_ROLES).describe('Participant role after the update'),
  updatedAt: z.iso.datetime().describe('ISO 8601 update timestamp'),
  updatedBy: z.uuid().describe('User ID that performed the update'),
});

export type UpdateRoomParticipantResponse = z.infer<typeof updateRoomParticipantResponseSchema>;

export const transitionRoomPhaseSchema = z
  .object({
    targetStatus: z.enum(ROOM_STATUSES).describe('Target room status to transition to'),
  })
  .strict();

export type TransitionRoomPhaseInput = z.infer<typeof transitionRoomPhaseSchema>;

export const transitionRoomPhaseResponseSchema = z.object({
  roomId: z.uuid().describe('Room identifier'),
  previousStatus: z.enum(ROOM_STATUSES).describe('Status before transition'),
  currentStatus: z.enum(ROOM_STATUSES).describe('Status after transition'),
  transitionedAt: z.iso.datetime().describe('ISO 8601 transition timestamp'),
  transitionedBy: z.uuid().describe('User ID that triggered the transition'),
});

export type TransitionRoomPhaseResponse = z.infer<typeof transitionRoomPhaseResponseSchema>;

// ── Browse public rooms ──────────────────────────────────────────────

export const BROWSEABLE_ROOM_STATUSES = ['waiting', 'warmup', 'coding', 'wrapup'] as const;

export type BrowseableRoomStatus = (typeof BROWSEABLE_ROOM_STATUSES)[number];

export const browseRoomsQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum(BROWSEABLE_ROOM_STATUSES)
    .optional()
    .describe('Filter by high-level browseable room status bucket')
    .meta({ examples: ['waiting'] }),
  language: z
    .enum(SUPPORTED_LANGUAGES)
    .optional()
    .describe('Filter by programming language')
    .meta({ examples: ['python'] }),
  difficulty: z
    .enum(PROBLEM_DIFFICULTIES)
    .optional()
    .describe('Filter by problem difficulty')
    .meta({ examples: ['easy'] }),
  search: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Free-text search across room name, problem title, and host username')
    .meta({ examples: ['two sum'] }),
});

export type BrowseRoomsQuery = z.infer<typeof browseRoomsQuerySchema>;

export const publicRoomSummarySchema = z.object({
  roomId: z.uuid().describe('Room identifier'),
  name: z.string().nullable().describe('Room name'),
  status: z.enum(ROOM_STATUSES).describe('Room status'),
  mode: z.enum(ROOM_MODES).describe('Room mode'),
  hostId: z.uuid().describe('Host user ID'),
  hostName: z.string().describe('Host username'),
  hostAvatarUrl: z.string().nullable().describe('Host avatar URL'),
  language: z.enum(SUPPORTED_LANGUAGES).nullable().describe('Programming language'),
  problemTitle: z.string().nullable().describe('Problem title'),
  problemDifficulty: z.enum(PROBLEM_DIFFICULTIES).nullable().describe('Problem difficulty'),
  participantCount: z.number().int().describe('Number of active participants'),
  maxParticipants: z.number().int().describe('Maximum participants allowed'),
  createdAt: z.iso.datetime().describe('ISO 8601 creation timestamp'),
});

export type PublicRoomSummary = z.infer<typeof publicRoomSummarySchema>;

export const browseRoomsResponseSchema = z.object({
  data: z.array(publicRoomSummarySchema),
  pagination: paginationSchema,
});

export type BrowseRoomsResponse = z.infer<typeof browseRoomsResponseSchema>;

// ── Change room language ────────────────────────────────────────────

export const changeRoomLanguageSchema = z
  .object({
    language: z
      .enum(SUPPORTED_LANGUAGES)
      .describe('Programming language to switch the room to')
      .meta({ examples: ['python'] }),
  })
  .strict();

export type ChangeRoomLanguageInput = z.infer<typeof changeRoomLanguageSchema>;

// ── Media token ──────────────────────────────────────────────────────

export const mediaTokenResponseSchema = z.object({
  token: z.string().describe('LiveKit JWT'),
  url: z.string().describe('LiveKit WebSocket URL'),
  expiresAt: z.iso.datetime().describe('Token expiry (ISO 8601)'),
});

export type MediaTokenResponse = z.infer<typeof mediaTokenResponseSchema>;
