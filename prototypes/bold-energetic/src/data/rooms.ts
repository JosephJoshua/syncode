export interface RoomParticipant {
  userId: string;
  role: 'interviewer' | 'candidate' | 'spectator';
  ready: boolean;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  hostId: string;
  problemId: string | null;
  stage: 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';
  maxParticipants: number;
  participants: RoomParticipant[];
  createdAt: string;
}

export const rooms: Room[] = [
  {
    id: 'r1',
    name: 'Morning Practice',
    code: 'ROOM01',
    hostId: 'u1',
    problemId: 'p1',
    stage: 'coding',
    maxParticipants: 4,
    participants: [
      { userId: 'u1', role: 'interviewer', ready: true },
      { userId: 'u2', role: 'candidate', ready: true },
      { userId: 'u3', role: 'spectator', ready: true },
    ],
    createdAt: '2026-03-07T08:00:00Z',
  },
  {
    id: 'r2',
    name: 'Algorithm Club',
    code: 'ALGO42',
    hostId: 'u3',
    problemId: 'p5',
    stage: 'waiting',
    maxParticipants: 4,
    participants: [
      { userId: 'u3', role: 'interviewer', ready: true },
      { userId: 'u4', role: 'candidate', ready: false },
    ],
    createdAt: '2026-03-07T09:00:00Z',
  },
  {
    id: 'r3',
    name: 'Hard Problems Only',
    code: 'HARD99',
    hostId: 'u2',
    problemId: 'p9',
    stage: 'warmup',
    maxParticipants: 3,
    participants: [
      { userId: 'u2', role: 'interviewer', ready: true },
      { userId: 'u5', role: 'candidate', ready: true },
    ],
    createdAt: '2026-03-07T10:00:00Z',
  },
  {
    id: 'r4',
    name: 'Quick Round',
    code: 'QCK007',
    hostId: 'u4',
    problemId: 'p3',
    stage: 'finished',
    maxParticipants: 2,
    participants: [
      { userId: 'u4', role: 'interviewer', ready: true },
      { userId: 'u1', role: 'candidate', ready: true },
    ],
    createdAt: '2026-03-06T14:00:00Z',
  },
  {
    id: 'r5',
    name: 'DP Workshop',
    code: 'DPPRO1',
    hostId: 'u1',
    problemId: 'p10',
    stage: 'coding',
    maxParticipants: 4,
    participants: [
      { userId: 'u1', role: 'interviewer', ready: true },
      { userId: 'u3', role: 'candidate', ready: true },
      { userId: 'u5', role: 'spectator', ready: true },
    ],
    createdAt: '2026-03-07T11:00:00Z',
  },
  {
    id: 'r6',
    name: 'Linked List Day',
    code: 'LINK22',
    hostId: 'u5',
    problemId: 'p4',
    stage: 'waiting',
    maxParticipants: 3,
    participants: [{ userId: 'u5', role: 'interviewer', ready: false }],
    createdAt: '2026-03-07T12:00:00Z',
  },
  {
    id: 'r7',
    name: 'Mock Interview',
    code: 'MOCK55',
    hostId: 'u2',
    problemId: 'p7',
    stage: 'wrapup',
    maxParticipants: 4,
    participants: [
      { userId: 'u2', role: 'interviewer', ready: true },
      { userId: 'u4', role: 'candidate', ready: true },
    ],
    createdAt: '2026-03-07T07:00:00Z',
  },
  {
    id: 'r8',
    name: 'Beginner Friendly',
    code: 'EZ1234',
    hostId: 'u3',
    problemId: 'p2',
    stage: 'waiting',
    maxParticipants: 6,
    participants: [
      { userId: 'u3', role: 'interviewer', ready: true },
      { userId: 'u1', role: 'candidate', ready: false },
      { userId: 'u5', role: 'spectator', ready: true },
    ],
    createdAt: '2026-03-07T13:00:00Z',
  },
];
