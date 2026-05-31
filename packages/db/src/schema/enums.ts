import * as shared from '@syncode/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

type WeaknessEnumConstants = Pick<typeof shared, 'WEAKNESS_CATEGORIES' | 'WEAKNESS_TRENDS'>;

function resolveWeaknessEnumConstants(): WeaknessEnumConstants {
  const runtimeShared = shared as typeof shared & { default?: WeaknessEnumConstants };
  if (runtimeShared.WEAKNESS_CATEGORIES && runtimeShared.WEAKNESS_TRENDS) {
    return runtimeShared;
  }
  if (runtimeShared.default) {
    return runtimeShared.default;
  }
  throw new Error('Shared weakness enum constants are unavailable');
}

const weaknessEnumConstants = resolveWeaknessEnumConstants();

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

export const sessionReportStatusEnum = pgEnum('session_report_status', [
  'pending',
  'completed',
  'failed',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export const staticAnalysisStatusEnum = pgEnum('static_analysis_status', [
  'pending',
  'completed',
  'failed',
]);

export const staticAnalysisSourceEnum = pgEnum('static_analysis_source', ['run', 'submission']);

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

export const weaknessCategoryEnum = pgEnum(
  'weakness_category',
  weaknessEnumConstants.WEAKNESS_CATEGORIES,
);

export const weaknessTrendEnum = pgEnum('weakness_trend', weaknessEnumConstants.WEAKNESS_TRENDS);
