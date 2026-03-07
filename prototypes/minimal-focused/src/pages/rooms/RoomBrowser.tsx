import { BookOpen, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Combobox } from '../../components/ui/Combobox';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { problems } from '../../data/problems';
import type { Room } from '../../data/rooms';
import { rooms } from '../../data/rooms';
import { users } from '../../data/users';

const problemOptions = problems.map((p) => ({
  value: p.id,
  label: p.title,
  secondary: `${p.difficulty} · ${p.tags.join(', ')}`,
}));

import { staggeredEntrance } from '../../lib/animations';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const STAGE_BADGE: Record<Room['stage'], { variant: BadgeVariant; className?: string }> = {
  waiting: { variant: 'neutral' },
  warmup: { variant: 'info' },
  coding: { variant: 'neutral', className: 'bg-[var(--accent-muted)] text-[var(--accent)]' },
  wrapup: { variant: 'warning' },
  finished: { variant: 'success' },
};

function hostName(hostId: string): string {
  return users.find((u) => u.id === hostId)?.name ?? 'Unknown';
}

export function RoomBrowser() {
  const navigate = useNavigate();
  const [showFinished, setShowFinished] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Create room form state
  const [roomName, setRoomName] = useState('');
  const [problemId, setProblemId] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('4');
  const [aiInterviewer, setAiInterviewer] = useState(false);

  const filtered = useMemo(() => {
    if (showFinished) return rooms;
    return rooms.filter((r) => r.stage !== 'finished');
  }, [showFinished]);

  const handleCreate = () => {
    setModalOpen(false);
    navigate('/rooms/ROOM01/lobby');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-xs tracking-widest uppercase text-[var(--accent)]">
            // active_rooms
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Rooms
          </h1>
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          Create Room
        </Button>
      </div>

      {/* Filter toggle */}
      <div className="mt-4">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showFinished}
            onChange={(e) => setShowFinished(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--border-default)] accent-[var(--accent)]"
          />
          <span className="font-mono text-xs text-[var(--text-secondary)]">Show finished</span>
        </label>
      </div>

      {/* Room card grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((room, i) => {
          const stageBadge = STAGE_BADGE[room.stage];
          return (
            <Card
              key={room.id}
              padding="p-4"
              className="transition-all duration-150 hover:border-[var(--border-strong)] hover:-translate-y-px cursor-pointer"
              onClick={() => navigate(`/rooms/${room.code}/lobby`)}
              style={staggeredEntrance(i)}
            >
              {/* Top row: name + stage */}
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] truncate mr-2">
                  {room.name}
                </h3>
                <Badge variant={stageBadge.variant} className={stageBadge.className ?? ''}>
                  {room.stage.charAt(0).toUpperCase() + room.stage.slice(1)}
                </Badge>
              </div>

              {/* Host */}
              <div className="flex items-center gap-1.5 mt-2">
                <Avatar name={hostName(room.hostId)} size="xs" />
                <span className="text-xs text-[var(--text-secondary)]">
                  {hostName(room.hostId)}
                </span>
              </div>

              {/* Problem name */}
              {room.problemId && (
                <div className="flex items-center gap-1 mt-1.5">
                  <BookOpen size={12} className="text-[var(--text-tertiary)] flex-none" />
                  <span className="font-mono text-xs text-[var(--text-tertiary)] truncate">
                    {problems.find((p) => p.id === room.problemId)?.title ?? 'Unknown Problem'}
                  </span>
                </div>
              )}

              {/* Participant count */}
              <p className="font-mono text-xs text-[var(--text-tertiary)] mt-2">
                {room.participants.length}/{room.maxParticipants} participants
              </p>

              {/* Room code */}
              <p className="font-mono text-xs text-[var(--text-tertiary)]">{room.code}</p>

              {/* Join button */}
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-3"
                onClick={() => navigate(`/rooms/${room.code}/lobby`)}
              >
                Join
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Create Room Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Room"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleCreate}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Room Name"
            placeholder="e.g. Morning Practice"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />

          <Combobox
            label="Problem"
            placeholder="Search problems..."
            options={problemOptions}
            value={problemId}
            onChange={(v) => setProblemId(v)}
          />

          <Select
            label="Max Participants"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </Select>

          {/* AI Interviewer toggle switch */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-primary)]">AI Interviewer</span>
            <button
              type="button"
              role="switch"
              aria-checked={aiInterviewer}
              onClick={() => setAiInterviewer(!aiInterviewer)}
              className={`relative w-10 h-5 rounded-full transition-colors duration-150 cursor-pointer ${
                aiInterviewer
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--bg-subtle)] border border-[var(--border-default)]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
                  aiInterviewer ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
