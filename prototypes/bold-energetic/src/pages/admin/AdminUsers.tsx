import { useState } from 'react';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';

import { users } from '../../data/users.ts';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  joinDate: string;
}

const adminUsers: AdminUser[] = users.map((u, i) => ({
  ...u,
  status: i === 3 ? ('suspended' as const) : ('active' as const),
}));

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = adminUsers.filter((u) => {
    if (
      search &&
      !u.name.toLowerCase().includes(search.toLowerCase()) &&
      !u.email.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (roleFilter === 'admin' && u.role !== 'admin') return false;
    if (roleFilter === 'student' && u.role !== 'user') return false;
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-xl font-bold">User Management</h1>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-32"
          >
            <option value="all">All</option>
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-subtle)]">
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Name
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Email
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Role
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Status
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Join Date
                </th>
                <th className="text-xs uppercase text-[var(--text-tertiary)] font-mono font-medium px-4 py-3 text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-[var(--border-default)] hover:bg-[var(--bg-subtle)]/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleOne(user.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm" name={user.name} />
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {user.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === 'admin' ? 'info' : 'neutral'}>
                      {user.role === 'admin' ? 'Admin' : 'Student'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.status === 'active' ? 'success' : 'error'}>
                      {user.status === 'active' ? 'Active' : 'Suspended'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {formatDate(user.joinDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-[var(--primary)]">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[var(--error)]">
                        Suspend
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
