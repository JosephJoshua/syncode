export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  joinDate: string;
  avatarUrl?: string;
}

export const users: User[] = [
  {
    id: 'u1',
    name: 'Alice Chen',
    email: 'alice@example.com',
    role: 'admin',
    joinDate: '2025-01-15',
  },
  { id: 'u2', name: 'Bob Kim', email: 'bob@example.com', role: 'user', joinDate: '2025-02-20' },
  { id: 'u3', name: 'Carol Wu', email: 'carol@example.com', role: 'user', joinDate: '2025-03-10' },
  { id: 'u4', name: 'David Li', email: 'david@example.com', role: 'user', joinDate: '2025-04-05' },
  { id: 'u5', name: 'Eve Zhang', email: 'eve@example.com', role: 'user', joinDate: '2025-05-18' },
];

export const currentUser = users[0];
