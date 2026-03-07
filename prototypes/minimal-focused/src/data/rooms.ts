export interface RoomParticipant {
  userId: string;
  role: 'interviewer' | 'candidate' | 'spectator';
  ready: boolean;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  participants: RoomParticipant[];
  stage: 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';
  problemId: string | null;
  createdAt: string;
  maxParticipants: number;
  aiInterviewer: boolean;
}

export const rooms: Room[] = [
  {
    id: 'r1',
    code: 'ABC123',
    name: 'Morning Warmup',
    hostId: '1',
    participants: [
      { userId: '1', role: 'interviewer', ready: true },
      { userId: '2', role: 'candidate', ready: true },
    ],
    stage: 'coding',
    problemId: 'p4',
    createdAt: '2026-03-07T08:00:00Z',
    maxParticipants: 4,
    aiInterviewer: false,
  },
  {
    id: 'r2',
    code: 'XYZ789',
    name: 'Graph Practice',
    hostId: '3',
    participants: [
      { userId: '3', role: 'interviewer', ready: true },
      { userId: '4', role: 'candidate', ready: false },
    ],
    stage: 'waiting',
    problemId: null,
    createdAt: '2026-03-07T09:30:00Z',
    maxParticipants: 2,
    aiInterviewer: false,
  },
  {
    id: 'r3',
    code: 'QWE456',
    name: 'AI Mock Interview',
    hostId: '5',
    participants: [{ userId: '5', role: 'candidate', ready: true }],
    stage: 'warmup',
    problemId: 'p1',
    createdAt: '2026-03-07T10:00:00Z',
    maxParticipants: 2,
    aiInterviewer: true,
  },
  {
    id: 'r4',
    code: 'RTY321',
    name: 'Hard Problems Only',
    hostId: '2',
    participants: [
      { userId: '2', role: 'interviewer', ready: true },
      { userId: '1', role: 'candidate', ready: true },
      { userId: '4', role: 'spectator', ready: true },
    ],
    stage: 'coding',
    problemId: 'p10',
    createdAt: '2026-03-06T14:00:00Z',
    maxParticipants: 6,
    aiInterviewer: false,
  },
  {
    id: 'r5',
    code: 'UIO654',
    name: 'Linked List Review',
    hostId: '4',
    participants: [
      { userId: '4', role: 'interviewer', ready: true },
      { userId: '5', role: 'candidate', ready: true },
    ],
    stage: 'wrapup',
    problemId: 'p5',
    createdAt: '2026-03-06T16:00:00Z',
    maxParticipants: 2,
    aiInterviewer: false,
  },
  {
    id: 'r6',
    code: 'ASD987',
    name: 'Weekend Grind',
    hostId: '1',
    participants: [
      { userId: '1', role: 'candidate', ready: true },
      { userId: '3', role: 'interviewer', ready: true },
    ],
    stage: 'finished',
    problemId: 'p9',
    createdAt: '2026-03-05T11:00:00Z',
    maxParticipants: 4,
    aiInterviewer: false,
  },
  {
    id: 'r7',
    code: 'FGH159',
    name: 'Tree Traversals',
    hostId: '5',
    participants: [
      { userId: '5', role: 'interviewer', ready: true },
      { userId: '2', role: 'candidate', ready: true },
    ],
    stage: 'coding',
    problemId: 'p7',
    createdAt: '2026-03-07T07:00:00Z',
    maxParticipants: 2,
    aiInterviewer: false,
  },
  {
    id: 'r8',
    code: 'JKL753',
    name: 'Open Practice',
    hostId: '3',
    participants: [{ userId: '3', role: 'candidate', ready: false }],
    stage: 'waiting',
    problemId: null,
    createdAt: '2026-03-07T12:00:00Z',
    maxParticipants: 4,
    aiInterviewer: true,
  },
];
