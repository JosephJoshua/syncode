import { relations } from 'drizzle-orm';
import { aiHints } from './ai-hints.js';
import { aiMessages } from './ai-messages.js';
import { aiReviews } from './ai-reviews.js';
import { auditLogs } from './audit-logs.js';
import { bookmarks } from './bookmarks.js';
import { codeSnapshots } from './code-snapshots.js';
import { executionResults } from './execution-results.js';
import { idempotencyKeys } from './idempotency-keys.js';
import { matchRequests } from './match-requests.js';
import { passwordResetTokens } from './password-reset-tokens.js';
import { peerFeedback } from './peer-feedback.js';
import { problemTags } from './problem-tags.js';
import { problems } from './problems.js';
import { recordingConsents } from './recording-consents.js';
import { refreshTokens } from './refresh-tokens.js';
import { roleSwapRequests } from './role-swap-requests.js';
import { roomParticipants } from './room-participants.js';
import { rooms } from './rooms.js';
import { runs } from './runs.js';
import { sessionDeletions } from './session-deletions.js';
import { sessionEvents } from './session-events.js';
import { sessionParticipants } from './session-participants.js';
import { sessionRecordings } from './session-recordings.js';
import { sessionReports } from './session-reports.js';
import { sessions } from './sessions.js';
import { submissions } from './submissions.js';
import { tags } from './tags.js';
import { testCases } from './test-cases.js';
import { userWeaknesses } from './user-weaknesses.js';
import { users } from './users.js';
import { weaknessSessions } from './weakness-sessions.js';

// Users
export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
  hostedRooms: many(rooms),
  roomParticipations: many(roomParticipants),
  runs: many(runs),
  submissions: many(submissions),
  bookmarks: many(bookmarks),
  peerFeedbackGiven: many(peerFeedback, { relationName: 'reviewer' }),
  peerFeedbackReceived: many(peerFeedback, { relationName: 'candidate' }),
  matchRequests: many(matchRequests, { relationName: 'requester' }),
  matchedRequests: many(matchRequests, { relationName: 'matchedWith' }),
  userWeaknesses: many(userWeaknesses),
  sessionParticipations: many(sessionParticipants),
  sessionDeletions: many(sessionDeletions),
  sessionEvents: many(sessionEvents),
  recordingConsents: many(recordingConsents),
  aiMessages: many(aiMessages),
  aiHints: many(aiHints),
  aiReviews: many(aiReviews),
  auditLogs: many(auditLogs),
  idempotencyKeys: many(idempotencyKeys),
  roleSwapRequestsSent: many(roleSwapRequests, { relationName: 'requester' }),
  roleSwapRequestsReceived: many(roleSwapRequests, { relationName: 'target' }),
}));

// Auth
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Rooms
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  host: one(users, {
    fields: [rooms.hostId],
    references: [users.id],
  }),
  problem: one(problems, {
    fields: [rooms.problemId],
    references: [problems.id],
  }),
  participants: many(roomParticipants),
  session: one(sessions),
  codeSnapshots: many(codeSnapshots),
  runs: many(runs),
  submissions: many(submissions),
  aiMessages: many(aiMessages),
  aiHints: many(aiHints),
  aiReviews: many(aiReviews),
  peerFeedback: many(peerFeedback),
  roleSwapRequests: many(roleSwapRequests),
  recordingConsents: many(recordingConsents),
  matchRequests: many(matchRequests),
}));

export const roomParticipantsRelations = relations(roomParticipants, ({ one }) => ({
  room: one(rooms, {
    fields: [roomParticipants.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [roomParticipants.userId],
    references: [users.id],
  }),
}));

// Problems
export const problemsRelations = relations(problems, ({ many }) => ({
  testCases: many(testCases),
  problemTags: many(problemTags),
  bookmarks: many(bookmarks),
  rooms: many(rooms),
  sessions: many(sessions),
  submissions: many(submissions),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  problemTags: many(problemTags),
}));

export const problemTagsRelations = relations(problemTags, ({ one }) => ({
  problem: one(problems, {
    fields: [problemTags.problemId],
    references: [problems.id],
  }),
  tag: one(tags, {
    fields: [problemTags.tagId],
    references: [tags.id],
  }),
}));

export const testCasesRelations = relations(testCases, ({ one }) => ({
  problem: one(problems, {
    fields: [testCases.problemId],
    references: [problems.id],
  }),
}));

// Sessions
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  room: one(rooms, {
    fields: [sessions.roomId],
    references: [rooms.id],
  }),
  problem: one(problems, {
    fields: [sessions.problemId],
    references: [problems.id],
  }),
  report: one(sessionReports),
  participants: many(sessionParticipants),
  events: many(sessionEvents),
  recordings: many(sessionRecordings),
  codeSnapshots: many(codeSnapshots),
  aiMessages: many(aiMessages),
  peerFeedback: many(peerFeedback),
  weaknessSessions: many(weaknessSessions),
  deletions: many(sessionDeletions),
}));

export const sessionParticipantsRelations = relations(sessionParticipants, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionParticipants.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [sessionParticipants.userId],
    references: [users.id],
  }),
}));

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvents.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [sessionEvents.userId],
    references: [users.id],
  }),
}));

export const sessionReportsRelations = relations(sessionReports, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionReports.sessionId],
    references: [sessions.id],
  }),
}));

export const sessionRecordingsRelations = relations(sessionRecordings, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionRecordings.sessionId],
    references: [sessions.id],
  }),
}));

export const sessionDeletionsRelations = relations(sessionDeletions, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionDeletions.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [sessionDeletions.userId],
    references: [users.id],
  }),
}));

// Code Snapshots
export const codeSnapshotsRelations = relations(codeSnapshots, ({ one }) => ({
  session: one(sessions, {
    fields: [codeSnapshots.sessionId],
    references: [sessions.id],
  }),
  room: one(rooms, {
    fields: [codeSnapshots.roomId],
    references: [rooms.id],
  }),
}));

// Execution
export const runsRelations = relations(runs, ({ one }) => ({
  user: one(users, {
    fields: [runs.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [runs.roomId],
    references: [rooms.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  user: one(users, {
    fields: [submissions.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [submissions.roomId],
    references: [rooms.id],
  }),
  problem: one(problems, {
    fields: [submissions.problemId],
    references: [problems.id],
  }),
  executionResults: many(executionResults),
}));

export const executionResultsRelations = relations(executionResults, ({ one }) => ({
  submission: one(submissions, {
    fields: [executionResults.submissionId],
    references: [submissions.id],
  }),
}));

// Bookmarks
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  problem: one(problems, {
    fields: [bookmarks.problemId],
    references: [problems.id],
  }),
}));

// Peer Feedback
export const peerFeedbackRelations = relations(peerFeedback, ({ one }) => ({
  session: one(sessions, {
    fields: [peerFeedback.sessionId],
    references: [sessions.id],
  }),
  room: one(rooms, {
    fields: [peerFeedback.roomId],
    references: [rooms.id],
  }),
  reviewer: one(users, {
    fields: [peerFeedback.reviewerId],
    references: [users.id],
    relationName: 'reviewer',
  }),
  candidate: one(users, {
    fields: [peerFeedback.candidateId],
    references: [users.id],
    relationName: 'candidate',
  }),
}));

// Matchmaking
export const matchRequestsRelations = relations(matchRequests, ({ one }) => ({
  user: one(users, {
    fields: [matchRequests.userId],
    references: [users.id],
    relationName: 'requester',
  }),
  matchedRoom: one(rooms, {
    fields: [matchRequests.matchedRoomId],
    references: [rooms.id],
  }),
  matchedWithUser: one(users, {
    fields: [matchRequests.matchedWithUserId],
    references: [users.id],
    relationName: 'matchedWith',
  }),
}));

// Weaknesses
export const userWeaknessesRelations = relations(userWeaknesses, ({ one, many }) => ({
  user: one(users, {
    fields: [userWeaknesses.userId],
    references: [users.id],
  }),
  weaknessSessions: many(weaknessSessions),
}));

export const weaknessSessionsRelations = relations(weaknessSessions, ({ one }) => ({
  weakness: one(userWeaknesses, {
    fields: [weaknessSessions.weaknessId],
    references: [userWeaknesses.id],
  }),
  session: one(sessions, {
    fields: [weaknessSessions.sessionId],
    references: [sessions.id],
  }),
}));

// Audit Logs
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

// AI
export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  room: one(rooms, {
    fields: [aiMessages.roomId],
    references: [rooms.id],
  }),
  session: one(sessions, {
    fields: [aiMessages.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [aiMessages.userId],
    references: [users.id],
  }),
}));

export const aiHintsRelations = relations(aiHints, ({ one }) => ({
  room: one(rooms, {
    fields: [aiHints.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [aiHints.userId],
    references: [users.id],
  }),
}));

export const aiReviewsRelations = relations(aiReviews, ({ one }) => ({
  room: one(rooms, {
    fields: [aiReviews.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [aiReviews.userId],
    references: [users.id],
  }),
}));

// Recording Consents
export const recordingConsentsRelations = relations(recordingConsents, ({ one }) => ({
  room: one(rooms, {
    fields: [recordingConsents.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [recordingConsents.userId],
    references: [users.id],
  }),
}));

// Idempotency Keys
export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  user: one(users, {
    fields: [idempotencyKeys.userId],
    references: [users.id],
  }),
}));

// Role Swap Requests
export const roleSwapRequestsRelations = relations(roleSwapRequests, ({ one }) => ({
  room: one(rooms, {
    fields: [roleSwapRequests.roomId],
    references: [rooms.id],
  }),
  requester: one(users, {
    fields: [roleSwapRequests.requesterId],
    references: [users.id],
    relationName: 'requester',
  }),
  targetUser: one(users, {
    fields: [roleSwapRequests.targetUserId],
    references: [users.id],
    relationName: 'target',
  }),
}));
