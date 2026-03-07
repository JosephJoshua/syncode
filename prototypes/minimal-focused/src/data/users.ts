export const users = [
  {
    id: '1',
    name: 'Alice Chen',
    email: 'alice@example.com',
    role: 'user' as const,
    avatar: null,
    joinDate: '2025-09-15',
  },
  {
    id: '2',
    name: 'Bob Park',
    email: 'bob@example.com',
    role: 'user' as const,
    avatar: null,
    joinDate: '2025-10-01',
  },
  {
    id: '3',
    name: 'Carol Wu',
    email: 'carol@example.com',
    role: 'admin' as const,
    avatar: null,
    joinDate: '2025-08-20',
  },
  {
    id: '4',
    name: 'David Kim',
    email: 'david@example.com',
    role: 'user' as const,
    avatar: null,
    joinDate: '2025-11-05',
  },
  {
    id: '5',
    name: 'Eve Zhang',
    email: 'eve@example.com',
    role: 'user' as const,
    avatar: null,
    joinDate: '2025-12-01',
  },
];

export type User = (typeof users)[number];

export const currentUser = users[0];
