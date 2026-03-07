import { BookmarkX, Inbox, Search, Star, Users, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Toaster, toast } from 'sonner';
import { CardGridSkeleton } from '../components/skeletons/CardGridSkeleton.tsx';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton.tsx';
import { TableSkeleton } from '../components/skeletons/TableSkeleton.tsx';
import { Avatar } from '../components/ui/Avatar.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Input, Textarea } from '../components/ui/Input.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { ProgressRing } from '../components/ui/ProgressRing.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="font-display text-xl font-bold text-[var(--text-primary)] mb-6 pb-2 border-b border-[var(--border-default)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DevGallery() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          },
        }}
      />

      <h1 className="font-display text-3xl font-bold gradient-text mb-2">Dev Gallery</h1>
      <p className="text-[var(--text-secondary)] mb-10">
        Bold &amp; Energetic design system — all shared UI primitives.
      </p>

      {/* Page Index */}
      <Section title="Page Index">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: 'Landing', to: '/' },
            { label: 'Login', to: '/login' },
            { label: 'Register', to: '/register' },
            { label: 'Forgot Password', to: '/forgot-password' },
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Session History', to: '/dashboard/history' },
            { label: 'Session Detail', to: '/dashboard/history/s1' },
            { label: 'Bookmarks', to: '/dashboard/bookmarks' },
            { label: 'Room Browser', to: '/rooms' },
            { label: 'Problem Browser', to: '/problems' },
            { label: 'Problem Detail', to: '/problems/p1' },
            { label: 'Create Room', to: '/rooms/create' },
            { label: 'Join Room', to: '/rooms/join' },
            { label: 'Interview Room', to: '/rooms/ROOM01' },
            { label: 'Profile', to: '/profile' },
            { label: 'Admin Dashboard', to: '/admin' },
            { label: 'Admin Users', to: '/admin/users' },
            { label: 'Admin Problems', to: '/admin/problems' },
            { label: 'Admin Analytics', to: '/admin/analytics' },
            { label: 'Admin System', to: '/admin/system' },
            { label: '404 Page', to: '/nonexistent' },
          ].map((page) => (
            <Link
              key={page.to}
              to={page.to}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--primary-muted)] hover:text-[var(--primary)] transition-colors"
            >
              <span className="text-[var(--text-tertiary)]">&rarr;</span>
              {page.label}
            </Link>
          ))}
        </div>
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div className="space-y-6">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-xs font-mono text-[var(--text-tertiary)]">{variant}</span>
              <Button variant={variant} size="sm">
                Small
              </Button>
              <Button variant={variant} size="md">
                Medium
              </Button>
              <Button variant={variant} size="lg">
                Large
              </Button>
              <Button variant={variant} size="md" disabled>
                Disabled
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm font-medium text-[var(--text-primary)]">Default Card</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">With default padding.</p>
          </Card>
          <Card padding="p-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">Compact Card</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Smaller padding.</p>
          </Card>
          <Card onClick={() => toast('Card clicked!')} padding="p-6">
            <p className="text-sm font-medium text-[var(--text-primary)]">Clickable Card</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Hover for lift effect.</p>
          </Card>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <div className="flex flex-wrap gap-3">
          {(
            ['success', 'warning', 'error', 'info', 'neutral', 'easy', 'medium', 'hard'] as const
          ).map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>
      </Section>

      {/* Inputs */}
      <Section title="Inputs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <Input placeholder="Default input" />
          <Input label="With Label" placeholder="Type here..." />
          <Input label="With Error" placeholder="Invalid" error="This field is required" />
          <Input label="Disabled" placeholder="Cannot edit" disabled />
          <div className="sm:col-span-2">
            <Textarea label="Textarea" placeholder="Write a description..." />
          </div>
        </div>
      </Section>

      {/* Select */}
      <Section title="Select">
        <div className="max-w-xs">
          <Select label="Language">
            <option value="">Choose...</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </Select>
        </div>
      </Section>

      {/* Avatars */}
      <Section title="Avatars">
        <div className="flex flex-wrap items-end gap-4">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => (
            <Avatar key={s} size={s} name="John Doe" />
          ))}
          <Avatar size="md" name="Alice W" online />
          <Avatar size="md" src="https://i.pravatar.cc/80?img=12" online />
          <Avatar size="md" />
        </div>
      </Section>

      {/* Modal */}
      <Section title="Modal">
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Open Modal
        </Button>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Confirm Action"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setModalOpen(false);
                  toast.success('Confirmed!');
                }}
              >
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-sm text-[var(--text-secondary)]">
            Are you sure you want to perform this action? This cannot be undone.
          </p>
        </Modal>
      </Section>

      {/* Toast */}
      <Section title="Toast (sonner)">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast('Default toast')}>
            Default
          </Button>
          <Button variant="secondary" onClick={() => toast.success('Operation succeeded!')}>
            Success
          </Button>
          <Button variant="danger" onClick={() => toast.error('Something went wrong')}>
            Error
          </Button>
        </div>
      </Section>

      {/* Empty States */}
      <Section title="Empty States">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <EmptyState
              icon={Inbox}
              heading="No sessions yet"
              description="Start a practice session to see your history here."
              ctaLabel="Start Session"
              onCtaClick={() => toast('Navigate to rooms')}
            />
          </Card>
          <Card>
            <EmptyState
              icon={Search}
              heading="No results"
              description="Try adjusting your search or filters."
            />
          </Card>
          <Card>
            <EmptyState
              icon={BookmarkX}
              heading="No bookmarks"
              description="Save problems you want to revisit later."
              ctaLabel="Browse Problems"
              onCtaClick={() => toast('Navigate to problems')}
            />
          </Card>
        </div>
      </Section>

      {/* Skeleton Primitives */}
      <Section title="Skeleton Primitives">
        <div className="space-y-4 max-w-md">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex items-center gap-3 mt-6">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      </Section>

      {/* Skeleton Compositions */}
      <Section title="Skeleton Compositions">
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
              DashboardSkeleton
            </h3>
            <DashboardSkeleton />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
              TableSkeleton
            </h3>
            <Card>
              <TableSkeleton rows={4} columns={5} />
            </Card>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
              CardGridSkeleton
            </h3>
            <CardGridSkeleton count={3} />
          </div>
        </div>
      </Section>

      {/* Progress Rings */}
      <Section title="Progress Rings">
        <div className="flex flex-wrap items-center gap-8">
          <ProgressRing value={85} />
          <ProgressRing value={62} />
          <ProgressRing value={100} />
        </div>
      </Section>

      {/* Icon Showcase */}
      <Section title="Icon Samples">
        <div className="flex flex-wrap gap-4">
          {[Star, Zap, Users, Search, Inbox].map((Icon, i) => (
            <div
              key={i}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            >
              <Icon size={20} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
