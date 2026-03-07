import { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';

const mockUsers = [
  {
    id: '1',
    name: 'Alice Chen',
    email: 'alice@example.com',
    role: 'user' as const,
    status: 'active' as const,
    joined: '2025-09-15',
  },
  {
    id: '2',
    name: 'Bob Park',
    email: 'bob@example.com',
    role: 'user' as const,
    status: 'active' as const,
    joined: '2025-10-01',
  },
  {
    id: '3',
    name: 'Carol Wu',
    email: 'carol@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    joined: '2025-08-20',
  },
  {
    id: '4',
    name: 'David Kim',
    email: 'david@example.com',
    role: 'user' as const,
    status: 'suspended' as const,
    joined: '2025-11-05',
  },
  {
    id: '5',
    name: 'Eve Zhang',
    email: 'eve@example.com',
    role: 'user' as const,
    status: 'active' as const,
    joined: '2025-12-01',
  },
  {
    id: '6',
    name: 'Frank Liu',
    email: 'frank@example.com',
    role: 'user' as const,
    status: 'active' as const,
    joined: '2025-12-10',
  },
  {
    id: '7',
    name: 'Grace Wang',
    email: 'grace@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    joined: '2025-07-14',
  },
  {
    id: '8',
    name: 'Henry Zhao',
    email: 'henry@example.com',
    role: 'user' as const,
    status: 'suspended' as const,
    joined: '2026-01-03',
  },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editUser, setEditUser] = useState<(typeof mockUsers)[number] | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');

  const openEditModal = (user: (typeof mockUsers)[number]) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  };

  const filtered = mockUsers.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
            // user_management
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Users
          </h1>
        </div>
        <div className="w-56">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="mt-3 w-40">
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </Select>
      </div>

      {/* Table */}
      <Card padding="p-0" className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-default)]">
              {['Avatar', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((heading) => (
                <th
                  key={heading}
                  className="text-left font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider px-4 py-3"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, idx) => (
              <tr
                key={user.id}
                className={`${
                  idx % 2 === 1 ? 'bg-[var(--bg-subtle)]/30' : ''
                } ${idx < filtered.length - 1 ? 'border-b border-[var(--border-default)]' : ''}`}
              >
                <td className="px-4 py-3">
                  <Avatar name={user.name} size="xs" />
                </td>
                <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{user.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === 'admin' ? 'success' : 'neutral'}>{user.role}</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        user.status === 'active'
                          ? 'bg-[var(--success)]'
                          : 'bg-[var(--text-tertiary)]'
                      }`}
                    />
                    <span className="font-mono text-xs">
                      {user.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">
                  {formatDate(user.joined)}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] hover:underline cursor-pointer"
                      onClick={() => openEditModal(user)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--error)] cursor-pointer"
                    >
                      Suspend
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Edit User Modal */}
      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title="Edit User"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={() => setEditUser(null)}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
          <Select label="Role" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}
