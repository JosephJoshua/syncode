import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['student', 'admin']);

export const roomStatusEnum = pgEnum('room_status', [
  'waiting',
  'warmup',
  'coding',
  'wrapup',
  'finished',
]);

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
