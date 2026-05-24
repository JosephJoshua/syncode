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

export const hintLevelSchema = z.enum(['subtle', 'moderate', 'direct']);
export type HintLevel = z.infer<typeof hintLevelSchema>;

export const requestRoomAiHintSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .describe('Current code snapshot in the editor')
      .meta({ examples: ['def two_sum(nums, target): ...'] }),
    language: z
      .enum(SUPPORTED_LANGUAGES)
      .describe('Programming language')
      .meta({ examples: ['python'] }),
    hintLevel: hintLevelSchema.describe('Hint intensity level'),
    followUpToHintId: z
      .uuid()
      .optional()
      .describe('Existing hint ID to continue as a stage-2 follow-up'),
    reflectionResponse: z
      .string()
      .max(2000)
      .optional()
      .describe('Optional learner reflection response for stage-2 follow-up'),
    noReply: z
      .boolean()
      .optional()
      .describe('Set true to continue follow-up without user reflection text'),
  })
  .refine(
    (value) => {
      const hasFollowUpTarget = Boolean(value.followUpToHintId);
      const hasReflection = Boolean(value.reflectionResponse?.trim());

      if (!hasFollowUpTarget) {
        return !hasReflection && value.noReply !== true;
      }

      return hasReflection || value.noReply === true;
    },
    {
      message:
        'Follow-up hints require followUpToHintId and either reflectionResponse or noReply=true',
      path: ['followUpToHintId'],
    },
  )
  .strict();

export type RequestRoomAiHintInput = z.infer<typeof requestRoomAiHintSchema>;

export const requestRoomAiHintResponseSchema = z.object({
  jobId: z.string().describe('AI hint job ID — poll GET /rooms/:id/ai/hint/:jobId for the result'),
  hintId: z.uuid().describe('Persistent hint identifier'),
  phase: z.enum(['initial', 'follow_up']).describe('Hint stage'),
});

export type RequestRoomAiHintResponse = z.infer<typeof requestRoomAiHintResponseSchema>;

export const getRoomAiHintResultResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    jobId: z.string(),
  }),
  z.object({
    status: z.literal('ready'),
    jobId: z.string(),
    hintId: z.uuid(),
    phase: z.enum(['initial', 'follow_up']),
    hint: z.string(),
    suggestedApproach: z.string().optional(),
    reflectionPrompt: z.string().optional(),
  }),
  z.object({
    status: z.literal('failed'),
    jobId: z.string(),
  }),
]);

export type GetRoomAiHintResultResponse = z.infer<typeof getRoomAiHintResultResponseSchema>;

export const aiInterviewQuestionTypes = [
  'complexity',
  'bug_risk',
  'edge_case',
  'optimization',
  'data_structure_choice',
  'correctness',
  'readability',
  'other',
] as const;

export const aiInterviewCodeContextSchema = z
  .object({
    language: z.enum(SUPPORTED_LANGUAGES).describe('Programming language for the code context'),
    file: z.string().min(1).max(120).describe('Display file or logical source name'),
    codeSnippet: z.string().min(1).max(4000).describe('Focused code snippet for the question'),
    startLine: z.number().int().positive().describe('1-based starting line for the snippet'),
    endLine: z.number().int().positive().describe('1-based ending line for the snippet'),
    startColumn: z.number().int().positive().optional().describe('1-based selection start column'),
    endColumn: z.number().int().positive().optional().describe('1-based selection end column'),
    cursorLine: z.number().int().positive().optional().describe('1-based cursor line'),
    cursorColumn: z.number().int().positive().optional().describe('1-based cursor column'),
    questionType: z
      .enum(aiInterviewQuestionTypes)
      .optional()
      .describe('Reason this context is relevant to the follow-up question'),
    reason: z.string().min(1).max(160).optional().describe('Short human-readable context reason'),
  })
  .refine((value) => value.endLine >= value.startLine, {
    message: 'endLine must be greater than or equal to startLine',
    path: ['endLine'],
  });

export type AiInterviewCodeContext = z.infer<typeof aiInterviewCodeContextSchema>;

export const aiInterviewExecutionSummarySchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  passedTestCases: z.number().int().nonnegative(),
  totalTestCases: z.number().int().nonnegative(),
  failedTestCases: z.number().int().nonnegative(),
  errorTestCases: z.number().int().nonnegative(),
  allTestsPassed: z.boolean(),
  submittedAt: z.iso.datetime(),
});

export type AiInterviewExecutionSummary = z.infer<typeof aiInterviewExecutionSummarySchema>;

export const aiInterviewCodeAnalysisContextSchema = z.object({
  summary: z.string().min(1).max(2000),
  focusAreas: z
    .object({
      complexity: z.string().min(1).max(1000),
      edgeCases: z.string().min(1).max(1000),
      readability: z.string().min(1).max(1000),
    })
    .optional(),
  followUpQuestions: z.array(z.string().min(1).max(500)).max(5).optional(),
  staticAnalysis: z
    .object({
      source: z.enum(['run', 'submission']),
      runId: z.uuid().nullable(),
      submissionId: z.uuid().nullable(),
      language: z.enum(SUPPORTED_LANGUAGES),
      createdAt: z.iso.datetime(),
      completedAt: z.iso.datetime().nullable(),
      summary: z.object({
        diagnosticCount: z.number().int().nonnegative(),
        errorCount: z.number().int().nonnegative(),
        warningCount: z.number().int().nonnegative(),
        maxCyclomaticComplexity: z.number().int().nullable(),
        highComplexityCount: z.number().int().nonnegative(),
        duplicationCount: z.number().int().nonnegative(),
        toolFailureCount: z.number().int().nonnegative(),
      }),
      diagnostics: z.array(
        z.object({
          tool: z.string(),
          rule: z.string().nullable(),
          severity: z.enum(['error', 'warning', 'info']),
          message: z.string(),
          file: z.string().nullable(),
          line: z.number().int().nullable(),
          column: z.number().int().nullable(),
        }),
      ),
      complexity: z.array(
        z.object({
          tool: z.string(),
          functionName: z.string(),
          file: z.string().nullable(),
          startLine: z.number().int(),
          endLine: z.number().int().nullable(),
          cyclomaticComplexity: z.number().int(),
        }),
      ),
      duplications: z.array(
        z.object({
          tool: z.string(),
          lines: z.number().int(),
          tokens: z.number().int().nullable(),
          occurrences: z.array(
            z.object({
              file: z.string().nullable(),
              startLine: z.number().int(),
              endLine: z.number().int().nullable(),
            }),
          ),
        }),
      ),
    })
    .optional(),
});

export type AiInterviewCodeAnalysisContext = z.infer<typeof aiInterviewCodeAnalysisContextSchema>;

export const aiInterviewRequestTriggerSchema = z.enum(['user_message', 'proactive']);
export type AiInterviewRequestTrigger = z.infer<typeof aiInterviewRequestTriggerSchema>;

export const aiInterviewProactiveReasonSchema = z.enum([
  'session_joined',
  'stage_changed',
  'user_idle',
  'hint_used',
  'manual_nudge',
]);
export type AiInterviewProactiveReason = z.infer<typeof aiInterviewProactiveReasonSchema>;

export const aiInterviewInteractionSignalsSchema = z
  .object({
    reason: aiInterviewProactiveReasonSchema,
    roomStatus: z.enum(ROOM_STATUSES),
    elapsedSeconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60),
    secondsSinceLastUserMessage: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60)
      .optional(),
    secondsSinceLastAssistantMessage: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60)
      .optional(),
    secondsSinceLastEditorActivity: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60)
      .optional(),
    recentEditorChanges: z.number().int().min(0).max(10_000).optional(),
    hintCount: z.number().int().min(0).max(200).optional(),
  })
  .strict();

export type AiInterviewInteractionSignals = z.infer<typeof aiInterviewInteractionSignalsSchema>;

export const requestRoomAiInterviewSchema = z
  .object({
    trigger: aiInterviewRequestTriggerSchema
      .default('user_message')
      .describe('How this interview request was triggered'),
    userMessage: z
      .string()
      .max(2000)
      .optional()
      .describe('Candidate message to the AI interviewer'),
    conversationHistory: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(4000),
        }),
      )
      .max(40)
      .describe('Prior conversation turns'),
    currentCode: z.string().max(16_000).describe('Current code in the editor'),
    codeContext: aiInterviewCodeContextSchema.describe('Specific code context for the follow-up'),
    latestExecutionSummary: aiInterviewExecutionSummarySchema.optional(),
    codeAnalysisContext: aiInterviewCodeAnalysisContextSchema.optional(),
    interactionSignals: aiInterviewInteractionSignalsSchema.optional(),
    responseLanguage: z
      .enum(['en', 'zh'])
      .optional()
      .describe('Preferred natural language for AI interviewer responses'),
  })
  .superRefine((value, ctx) => {
    if (value.trigger !== 'user_message') {
      return;
    }
    if ((value.userMessage?.trim().length ?? 0) > 0) {
      return;
    }
    ctx.addIssue({
      code: 'custom',
      path: ['userMessage'],
      message: 'userMessage is required when trigger is user_message',
    });
  })
  .strict();

export type RequestRoomAiInterviewInput = z.infer<typeof requestRoomAiInterviewSchema>;

export const requestRoomAiInterviewResponseSchema = z.object({
  jobId: z
    .string()
    .describe('AI interview job ID — poll GET /rooms/:id/ai/interview/:jobId for the result'),
});

export type RequestRoomAiInterviewResponse = z.infer<typeof requestRoomAiInterviewResponseSchema>;

export const getRoomAiInterviewResultResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    jobId: z.string(),
  }),
  z.object({
    status: z.literal('ready'),
    jobId: z.string(),
    shouldRespond: z.boolean(),
    message: z.string().optional(),
    followUpQuestion: z.string().optional(),
    codeContext: aiInterviewCodeContextSchema.optional(),
    codeAnnotations: z.array(z.object({ line: z.number().int(), comment: z.string() })).optional(),
    audioUrl: z.string().url().optional(),
  }),
  z.object({
    status: z.literal('failed'),
    jobId: z.string(),
  }),
]);

export type GetRoomAiInterviewResultResponse = z.infer<
  typeof getRoomAiInterviewResultResponseSchema
>;

export const INTERVIEW_TRANSCRIPTION_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
] as const;

function isAllowedInterviewTranscriptionMimeType(value: string) {
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === undefined) {
    return false;
  }
  return (INTERVIEW_TRANSCRIPTION_MIME_TYPES as readonly string[]).includes(normalized);
}

export const requestRoomAiInterviewTranscriptionSchema = z
  .object({
    audioBase64: z
      .string()
      .min(1)
      .max(4_000_000)
      .describe('Base64 audio payload captured from the interviewer input'),
    mimeType: z
      .string()
      .min(1)
      .max(120)
      .refine(isAllowedInterviewTranscriptionMimeType, 'Unsupported audio MIME type')
      .describe('Audio MIME type'),
    language: z
      .string()
      .min(2)
      .max(20)
      .optional()
      .describe('Optional spoken language hint (for example en-US)'),
  })
  .strict();

export type RequestRoomAiInterviewTranscriptionInput = z.infer<
  typeof requestRoomAiInterviewTranscriptionSchema
>;

export const requestRoomAiInterviewTranscriptionResponseSchema = z.object({
  text: z.string().describe('Transcribed text content'),
});

export type RequestRoomAiInterviewTranscriptionResponse = z.infer<
  typeof requestRoomAiInterviewTranscriptionResponseSchema
>;

export const requestRoomCodeAnalysisSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(16_000)
      .describe('Current code snapshot in the editor')
      .meta({ examples: ['def two_sum(nums, target): ...'] }),
    language: z
      .enum(SUPPORTED_LANGUAGES)
      .describe('Programming language')
      .meta({ examples: ['python'] }),
  })
  .strict();

export type RequestRoomCodeAnalysisInput = z.infer<typeof requestRoomCodeAnalysisSchema>;

export const requestRoomCodeAnalysisResponseSchema = z.object({
  jobId: z
    .string()
    .describe('AI code analysis job ID - poll GET /rooms/:id/ai/code-analysis/:jobId'),
});

export type RequestRoomCodeAnalysisResponse = z.infer<typeof requestRoomCodeAnalysisResponseSchema>;

export const getRoomCodeAnalysisResultResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    jobId: z.string(),
  }),
  z.object({
    status: z.literal('ready'),
    jobId: z.string(),
    summary: z.string(),
    focusAreas: z.object({
      complexity: z.string(),
      edgeCases: z.string(),
      readability: z.string(),
    }),
    followUpQuestions: z.array(z.string()),
  }),
  z.object({
    status: z.literal('failed'),
    jobId: z.string(),
  }),
]);

export type GetRoomCodeAnalysisResultResponse = z.infer<
  typeof getRoomCodeAnalysisResultResponseSchema
>;

export const roomChatMediaUploadRequestSchema = z
  .object({
    fileName: z
      .string()
      .min(1)
      .max(255)
      .describe('Original file name')
      .meta({ examples: ['debug-output.png'] }),
    contentType: z
      .string()
      .min(1)
      .max(255)
      .describe('MIME type')
      .meta({ examples: ['image/png'] }),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .describe('File size in bytes')
      .meta({ examples: [204_800] }),
  })
  .strict();

export type RoomChatMediaUploadInput = z.infer<typeof roomChatMediaUploadRequestSchema>;

export const roomChatMediaUploadResponseSchema = z.object({
  key: z.string().describe('Storage object key'),
  uploadUrl: z.string().describe('Presigned PUT upload URL'),
  downloadUrl: z.string().describe('Download URL for rendering in chat'),
  fileName: z.string().describe('Original file name'),
  contentType: z.string().describe('MIME type'),
  sizeBytes: z.number().int().positive().describe('File size in bytes'),
});

export type RoomChatMediaUploadResponse = z.infer<typeof roomChatMediaUploadResponseSchema>;

export const submitResponseSchema = z.object({
  submissionId: z
    .uuid()
    .describe('Submission ID for polling results via GET /submissions/:submissionId')
    .meta({ examples: ['550e8400-e29b-41d4-a716-446655440000'] }),
  staticAnalysisJobId: z
    .uuid()
    .nullable()
    .optional()
    .describe('Optional static analysis job ID for polling code-quality diagnostics')
    .meta({ examples: ['660e8400-e29b-41d4-a716-446655440000'] }),
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
  staticAnalysisJobId: z
    .uuid()
    .nullable()
    .optional()
    .describe('Optional static analysis job ID for polling code-quality diagnostics')
    .meta({ examples: ['660e8400-e29b-41d4-a716-446655440000'] }),
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
  sessionId: z.uuid().nullable().describe('Current or completed session for this room'),
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
      .describe(
        '6-char invite code (required for private rooms / first-time join, optional for public rooms or when reactivating)',
      )
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

export const lockEditorResponseSchema = z.object({
  roomId: z.uuid().describe('Room identifier'),
  editorLocked: z.literal(true).describe('Always true after a successful lock'),
  changed: z.boolean().describe('Whether this call mutated state (false on idempotent no-ops)'),
  lockedAt: z.iso
    .datetime()
    .optional()
    .describe('ISO 8601 timestamp when the lock was applied. Omitted on no-ops.'),
  lockedBy: z.uuid().optional().describe('User ID that applied the lock. Omitted on no-ops.'),
});

export type LockEditorResponse = z.infer<typeof lockEditorResponseSchema>;

export const unlockEditorResponseSchema = z.object({
  roomId: z.uuid().describe('Room identifier'),
  editorLocked: z.literal(false).describe('Always false after a successful unlock'),
  changed: z.boolean().describe('Whether this call mutated state (false on idempotent no-ops)'),
  unlockedAt: z.iso
    .datetime()
    .optional()
    .describe('ISO 8601 timestamp when the lock was released. Omitted on no-ops.'),
  unlockedBy: z.uuid().optional().describe('User ID that released the lock. Omitted on no-ops.'),
});

export type UnlockEditorResponse = z.infer<typeof unlockEditorResponseSchema>;

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
    .describe('Case-insensitive substring match on problem title')
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
  isParticipant: z
    .boolean()
    .describe('Whether the requesting user is an active participant in this room.'),
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

// ── Collab recovery ──────────────────────────────────────────────────

export const ensureCollabResponseSchema = z.object({
  recreated: z
    .boolean()
    .describe('True if the collab doc was missing and has been recreated from the stored snapshot'),
});

export type EnsureCollabResponse = z.infer<typeof ensureCollabResponseSchema>;

// ── Media token ──────────────────────────────────────────────────────

export const mediaTokenResponseSchema = z.object({
  token: z.string().describe('LiveKit JWT'),
  url: z.string().describe('LiveKit WebSocket URL'),
  expiresAt: z.iso.datetime().describe('Token expiry (ISO 8601)'),
});

export type MediaTokenResponse = z.infer<typeof mediaTokenResponseSchema>;
