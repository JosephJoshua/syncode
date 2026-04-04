export type SessionRole = 'candidate' | 'interviewer' | 'observer';
export type SessionStatus = 'passed' | 'failed' | null;

export type SessionParticipant = {
  initials: string;
  isCurrentUser?: boolean;
};

export type SessionRow = {
  id: string;
  date: string;
  problemName: string;
  partner: SessionParticipant | null;
  observer: SessionParticipant | null;
  role: SessionRole;
  status: SessionStatus;
  score: number | null;
  durationMinutes: number;
};

export const MOCK_SESSION_ROWS: SessionRow[] = [
  {
    id: 'session-1',
    date: '2024-03-20',
    problemName: 'Two Sum',
    partner: { initials: 'BP' },
    observer: null,
    role: 'candidate',
    status: 'passed',
    score: 100,
    durationMinutes: 45,
  },
  {
    id: 'session-2',
    date: '2024-03-19',
    problemName: 'Longest Substring Without Repeating Characters',
    partner: { initials: 'CW' },
    observer: { initials: 'AL' },
    role: 'candidate',
    status: 'failed',
    score: 64,
    durationMinutes: 38,
  },
  {
    id: 'session-3',
    date: '2024-03-18',
    problemName: 'Binary Tree Level Order Traversal',
    partner: { initials: 'DK' },
    observer: null,
    role: 'interviewer',
    status: null,
    score: null,
    durationMinutes: 32,
  },
  {
    id: 'session-4',
    date: '2024-03-17',
    problemName: 'Trapping Rain Water',
    partner: null,
    observer: { initials: 'ME', isCurrentUser: true },
    role: 'observer',
    status: null,
    score: null,
    durationMinutes: 55,
  },
  {
    id: 'session-5',
    date: '2024-03-16',
    problemName: 'Valid Parentheses',
    partner: { initials: 'EZ' },
    observer: { initials: 'MN' },
    role: 'candidate',
    status: 'passed',
    score: 95,
    durationMinutes: 20,
  },
  {
    id: 'session-6',
    date: '2024-03-15',
    problemName: 'LRU Cache',
    partner: { initials: 'BP' },
    observer: null,
    role: 'interviewer',
    status: null,
    score: null,
    durationMinutes: 48,
  },
];
