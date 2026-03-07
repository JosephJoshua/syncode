import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/history', label: 'History', icon: History, end: false },
  { to: '/dashboard/bookmarks', label: 'Bookmarks', icon: Bookmark, end: false },
  { to: '/profile', label: 'Settings', icon: Settings, end: false },
] as const;

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-14rem)]">
      {/* Sidebar */}
      <aside
        className="bg-[var(--bg-card)] border-r border-[var(--border-default)] flex flex-col shrink-0"
        style={{
          width: collapsed ? 64 : 240,
          transition: 'width 200ms ease',
        }}
      >
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center h-10 mx-2 mt-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 mt-2 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--primary-muted)] text-[var(--primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
                ].join(' ')
              }
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--gradient-surface)' }}>
        <Outlet />
      </div>
    </div>
  );
}
