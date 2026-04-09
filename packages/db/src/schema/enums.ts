import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const roomStatusEnum = pgEnum('room_status', [
  'waiting',
  'warmup',
  'coding',
  'wrapup',
  'finished',
]);

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);

export const supportedLanguageEnum = pgEnum('supported_language', [
  'python',
  'javascript',
  'typescript',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
]);

export const roomModeEnum = pgEnum('room_mode', ['ai', 'peer']);

export const roomRoleEnum = pgEnum('room_role', ['interviewer', 'candidate', 'observer']);

export const sessionStatusEnum = pgEnum('session_status', ['ongoing', 'finished']);

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export const snapshotTriggerEnum = pgEnum('snapshot_trigger', [
  'submission',
  'phase_change',
  'periodic',
  'manual',
  'session_end',
]);

export const hintLevelEnum = pgEnum('hint_level', ['subtle', 'moderate', 'direct']);

export const aiMessageRoleEnum = pgEnum('ai_message_role', ['user', 'assistant']);

export const followUpTypeEnum = pgEnum('follow_up_type', [
  'question',
  'hint',
  'evaluation',
  'encouragement',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'pending',
  'matched',
  'expired',
  'cancelled',
]);

export const roleSwapStatusEnum = pgEnum('role_swap_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
]);

export const weaknessCategoryEnum = pgEnum('weakness_category', [
  'edge_cases',
  'time_complexity',
  'space_complexity',
  'variable_naming',
  'code_structure',
  'off_by_one',
  'input_validation',
  'communication',
]);

export const weaknessTrendEnum = pgEnum('weakness_trend', ['improving', 'stable', 'worsening']);
