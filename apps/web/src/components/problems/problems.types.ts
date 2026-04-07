export type ProblemDifficulty = 'Easy' | 'Medium' | 'Hard';
export type ProblemStatus = 'Solved' | 'Attempted' | 'Todo';
export type ProblemSortKey = 'newest' | 'acceptance' | 'difficulty';

export interface ProblemItem {
  id: string;
  title: string;
  difficulty: ProblemDifficulty;
  status: ProblemStatus;
  acceptanceRate: number;
  tags: string[];
  addedAt: number;
}

export const DIFFICULTY_OPTIONS: ProblemDifficulty[] = ['Easy', 'Medium', 'Hard'];
export const STATUS_OPTIONS: ProblemStatus[] = ['Solved', 'Attempted', 'Todo'];

export const SORT_OPTIONS: Array<{ label: string; value: ProblemSortKey }> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Acceptance rate', value: 'acceptance' },
  { label: 'Difficulty', value: 'difficulty' },
];
