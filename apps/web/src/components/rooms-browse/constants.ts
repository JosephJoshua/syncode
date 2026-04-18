import type { BrowseableRoomStatus } from '@syncode/contracts';
import type { ProblemDifficulty, SupportedLanguage } from '@syncode/shared';

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
};

export const DIFFICULTY_KEYS: Record<ProblemDifficulty, string> = {
  easy: 'browse.filters.difficultyEasy',
  medium: 'browse.filters.difficultyMedium',
  hard: 'browse.filters.difficultyHard',
};

export const DIFFICULTY_STYLES: Record<ProblemDifficulty, string> = {
  easy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  hard: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
};

export const BROWSEABLE_STATUSES: BrowseableRoomStatus[] = [
  'waiting',
  'warmup',
  'coding',
  'wrapup',
];

export const STATUS_KEYS: Record<BrowseableRoomStatus, string> = {
  waiting: 'status.waiting',
  warmup: 'status.warmup',
  coding: 'status.coding',
  wrapup: 'status.wrapup',
};

export const STATUS_STYLES: Record<BrowseableRoomStatus, { dot: string; badge: string }> = {
  waiting: {
    dot: 'bg-amber-400 shadow-[0_0_6px_oklch(0.76_0.16_75/0.6)]',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  warmup: {
    dot: 'bg-sky-400 shadow-[0_0_6px_oklch(0.72_0.14_230/0.6)]',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  },
  coding: {
    dot: 'bg-primary shadow-[0_0_6px_oklch(0.82_0.18_165/0.6)] animate-pulse',
    badge: 'border-primary/30 bg-primary/10 text-primary',
  },
  wrapup: {
    dot: 'bg-violet-400 shadow-[0_0_6px_oklch(0.65_0.18_290/0.6)]',
    badge: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
  },
};
