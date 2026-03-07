import { Bell, CalendarDays, DoorOpen, Inbox, Plus, Search, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Toaster, toast } from 'sonner';
import { CardGridSkeleton } from '../components/skeletons/CardGridSkeleton';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { TableSkeleton } from '../components/skeletons/TableSkeleton';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { staggeredEntrance } from '../lib/animations';

function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section className="space-y-4" style={style}>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border-default)] pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DevGallery() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)',
          },
        }}
      />

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dev Gallery</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            All shared UI primitives in one place.
          </p>
        </div>

        {/* Page Index */}
        <Section title="Page Index" style={staggeredEntrance(0, 100)}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: 'Landing', to: '/' },
              { label: 'Login', to: '/login' },
              { label: 'Register', to: '/register' },
              { label: 'Forgot Password', to: '/forgot-password' },
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Session History', to: '/dashboard/sessions' },
              { label: 'Session Detail', to: '/dashboard/sessions/s1' },
              { label: 'Problem Browser', to: '/problems' },
              { label: 'Problem Detail', to: '/problems/p1' },
              { label: 'Room Browser', to: '/rooms' },
              { label: 'Join Room', to: '/rooms/join' },
              { label: 'Room Lobby', to: '/rooms/ROOM01/lobby' },
              { label: 'Interview Room', to: '/rooms/ROOM01/session' },
              { label: 'Profile', to: '/profile' },
              { label: 'Settings', to: '/profile/settings' },
              { label: 'Admin Dashboard', to: '/admin' },
              { label: 'Admin Users', to: '/admin/users' },
              { label: 'Admin Problems', to: '/admin/problems' },
              { label: 'Admin System', to: '/admin/system' },
              { label: '404 Page', to: '/nonexistent' },
            ].map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--accent)] transition-colors font-mono"
              >
                <span className="text-[var(--text-tertiary)]">→</span>
                {page.label}
              </Link>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons" style={staggeredEntrance(1, 100)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">
                Primary SM
              </Button>
              <Button variant="primary" size="md">
                Primary MD
              </Button>
              <Button variant="primary" size="lg">
                Primary LG
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm">
                Secondary SM
              </Button>
              <Button variant="secondary" size="md">
                Secondary MD
              </Button>
              <Button variant="secondary" size="lg">
                Secondary LG
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm">
                Ghost SM
              </Button>
              <Button variant="ghost" size="md">
                Ghost MD
              </Button>
              <Button variant="ghost" size="lg">
                Ghost LG
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled>
                Disabled Primary
              </Button>
              <Button variant="secondary" disabled>
                Disabled Secondary
              </Button>
              <Button variant="ghost" disabled>
                Disabled Ghost
              </Button>
            </div>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards" style={staggeredEntrance(2, 100)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Default Card</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This card uses default padding (p-5).
              </p>
            </Card>
            <Card padding="p-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Compact Card</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This card uses compact padding (p-3).
              </p>
            </Card>
            <Card padding="p-8">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Spacious Card</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This card uses spacious padding (p-8).
              </p>
            </Card>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges" style={staggeredEntrance(3, 100)}>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="easy">Easy</Badge>
            <Badge variant="medium">Medium</Badge>
            <Badge variant="hard">Hard</Badge>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Inputs" style={staggeredEntrance(4, 100)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <Input placeholder="Normal input" />
            <Input label="With Label" placeholder="Enter something..." />
            <Input label="With Error" placeholder="Wrong value" error="This field is required" />
            <Input label="Disabled" placeholder="Can't touch this" disabled />
            <div className="md:col-span-2">
              <Textarea label="Textarea" placeholder="Write a longer message..." />
            </div>
          </div>
        </Section>

        {/* Select */}
        <Section title="Select" style={staggeredEntrance(5, 100)}>
          <div className="max-w-xs">
            <Select label="Language">
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </Select>
          </div>
        </Section>

        {/* Avatars */}
        <Section title="Avatars" style={staggeredEntrance(6, 100)}>
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <Avatar size="xs" name="John Doe" />
              <Avatar size="sm" name="John Doe" />
              <Avatar size="md" name="John Doe" />
              <Avatar size="lg" name="John Doe" />
              <Avatar size="xl" name="John Doe" />
            </div>
            <div className="flex items-end gap-4">
              <Avatar size="sm" name="Alice B" online />
              <Avatar size="md" name="Charlie D" online />
              <Avatar size="lg" name="Eve F" online />
            </div>
            <div className="flex items-end gap-4">
              <Avatar size="md" name="Photo User" src="https://i.pravatar.cc/100?img=5" />
              <Avatar size="md" name="Photo User" src="https://i.pravatar.cc/100?img=12" online />
              <Avatar size="md" />
            </div>
          </div>
        </Section>

        {/* Modal */}
        <Section title="Modal" style={staggeredEntrance(7, 100)}>
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            footer={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Confirm
                </Button>
              </>
            }
          >
            <p className="text-sm text-[var(--text-secondary)]">
              This is a modal dialog. Press Escape or click the backdrop to close it.
            </p>
          </Modal>
        </Section>

        {/* Toast */}
        <Section title="Toast" style={staggeredEntrance(8, 100)}>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => toast.success('Action completed!')}>
              Success Toast
            </Button>
            <Button variant="secondary" onClick={() => toast.error('Something went wrong')}>
              Error Toast
            </Button>
            <Button variant="secondary" onClick={() => toast('A neutral notification')}>
              Default Toast
            </Button>
          </div>
        </Section>

        {/* Empty States */}
        <Section title="// empty_states" style={staggeredEntrance(9, 100)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <EmptyState
                icon={CalendarDays}
                heading="No sessions yet"
                description="Complete your first practice session to see your history here."
                ctaLabel="Create Room"
                onCtaClick={() => toast('Room created!')}
              />
            </Card>
            <Card>
              <EmptyState
                icon={DoorOpen}
                heading="No rooms available"
                description="Create a room or wait for one to open."
                ctaLabel="Create Room"
                onCtaClick={() => toast('Room created!')}
              />
            </Card>
            <Card>
              <EmptyState
                icon={Search}
                heading="No results found"
                description="Try adjusting your search or filters."
              />
            </Card>
          </div>
        </Section>

        {/* Skeletons */}
        <Section title="Skeletons" style={staggeredEntrance(10, 100)}>
          <div className="space-y-8">
            {/* Primitives */}
            <div className="space-y-4">
              <p className="text-xs font-mono text-[var(--text-tertiary)]">// primitives</p>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>

            {/* Dashboard Skeleton */}
            <div className="space-y-3">
              <p className="text-xs font-mono text-[var(--text-tertiary)]">// dashboard_skeleton</p>
              <DashboardSkeleton />
            </div>

            {/* Table Skeleton */}
            <div className="space-y-3">
              <p className="text-xs font-mono text-[var(--text-tertiary)]">// table_skeleton</p>
              <Card>
                <TableSkeleton rows={3} columns={5} />
              </Card>
            </div>

            {/* Card Grid Skeleton */}
            <div className="space-y-3">
              <p className="text-xs font-mono text-[var(--text-tertiary)]">// card_grid_skeleton</p>
              <CardGridSkeleton count={3} />
            </div>
          </div>
        </Section>

        {/* 404 Preview */}
        <Section title="404 Page" style={staggeredEntrance(11, 100)}>
          <Card className="overflow-hidden" padding="p-0">
            <div className="relative flex items-center justify-center py-16 bg-[var(--bg-base)]">
              <div
                className="absolute inset-0 pointer-events-none dot-grid-lg"
                style={{ opacity: 0.1 }}
              />
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, var(--accent-muted) 0%, transparent 70%)',
                  opacity: 0.4,
                }}
              />
              <div className="relative z-[1] flex flex-col items-center text-center">
                <span className="font-mono text-5xl font-bold text-[var(--text-tertiary)] opacity-20 select-none">
                  404
                </span>
                <h3 className="font-display text-sm font-bold text-[var(--text-primary)] mt-2">
                  Page not found
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  The page you're looking for doesn't exist.
                </p>
                <Link
                  to="/dashboard"
                  className="font-mono text-xs text-[var(--accent)] hover:underline mt-3"
                >
                  // go_home
                </Link>
              </div>
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}
