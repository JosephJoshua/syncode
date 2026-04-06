import {
  JOINABLE_ROLES,
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

export const testCaseSchema = z
  .object({
    input: z
      .string()
      .min(1)
      .describe('Input provided via stdin')
      .meta({ examples: ['5\n3 1 4 1 5'] }),
    expectedOutput: z
      .string()
      .min(1)
      .describe('Expected stdout output')
      .meta({ examples: ['1 1 3 4 5'] }),
    description: z
      .string()
      .optional()
      .describe('Test case description')
      .meta({ examples: ['Basic sorting test'] }),
    timeoutMs: z
      .number()
      .positive()
      .optional()
      .describe('Per-test timeout override (ms)')
      .meta({ examples: [5000] }),
    memoryMb: z
      .number()
      .positive()
      .optional()
      .describe('Per-test memory limit override (MB)')
      .meta({ examples: [128] }),
  })
  .strict();

export type TestCaseInput = z.infer<typeof testCaseSchema>;

export const submitProblemSchema = runCodeSchema
  .omit({ stdin: true })
  .extend({
    testCases: z.array(testCaseSchema).nonempty().describe('Test cases to run the code against'),
  })
  .strict();

export type SubmitProblemInput = z.infer<typeof submitProblemSchema>;

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

export const runCodeResponseSchema = z.object({
  jobId: z
    .string()
    .describe('Job ID for polling execution result via GET /execution/:jobId')
    .meta({ examples: ['exec-job-abc-123'] }),
});

export type RunCodeResponse = z.infer<typeof runCodeResponseSchema>;

export const submitResultItemSchema = z.object({
  jobId: z
    .string()
    .nullable()
    .describe('Job ID for this test case. null if the submission failed to enqueue.')
    .meta({ examples: ['exec-job-abc-123'] }),
  testCaseIndex: z
    .number()
    .describe('Index of the test case in the submitted array')
    .meta({ examples: [0] }),
  description: z
    .string()
    .optional()
    .describe('Test case description (echoed from input)')
    .meta({ examples: ['Basic sorting test'] }),
  error: z
    .string()
    .optional()
    .describe('Present when the test case failed to enqueue. jobId will be null.')
    .meta({ examples: ['submission_failed'] }),
});

export type SubmitResultItem = z.infer<typeof submitResultItemSchema>;

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
  isActive: z.boolean().describe('Whether the participant is currently connected'),
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
});

export type RoomDetail = z.infer<typeof roomDetailSchema>;

export const joinRoomSchema = z
  .object({
    roomCode: z
      .string()
      .length(6)
      .describe('6-char invite code')
      .meta({ examples: ['A3K7M2'] }),
    preferredRole: z.enum(JOINABLE_ROLES).optional().describe('Preferred role in the room'),
  })
  .strict();

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const joinRoomResponseSchema = z.object({
  room: roomDetailSchema.describe('Full room detail after joining'),
  assignedRole: z.enum(ROOM_ROLES).describe('The role assigned to the joining user'),
  myCapabilities: z.array(z.string()).describe('Resolved room capabilities for assigned role'),
  collabToken: z.string().describe('Yjs auth token for collab-plane WebSocket'),
  collabUrl: z.string().describe('Collab-plane WebSocket URL'),
});

export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;

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
