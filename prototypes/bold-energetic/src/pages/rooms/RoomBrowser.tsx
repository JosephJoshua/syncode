import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { problems } from '../../data/problems.ts';
import { rooms } from '../../data/rooms.ts';
import { users } from '../../data/users.ts';

const stageBadgeVariant = {
  waiting: 'neutral',
  warmup: 'warning',
  coding: 'info',
  wrapup: 'warning',
  finished: 'success',
} as const;

export function RoomBrowser() {
  const [showFinished, setShowFinished] = useState(false);

  const filteredRooms = showFinished ? rooms : rooms.filter((r) => r.stage !== 'finished');

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Active Rooms</h1>

        <div className="flex items-center gap-3">
          <Link to="/rooms/join">
            <Button variant="secondary" size="sm">
              Join with Code
            </Button>
          </Link>
          <Link to="/rooms/create">
            <Button variant="primary" size="sm" className="gap-1.5">
              <Plus size={16} />
              Create Room
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter */}
      <label className="inline-flex items-center gap-2 mb-6 cursor-pointer text-sm text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={showFinished}
          onChange={(e) => setShowFinished(e.target.checked)}
          className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
        />
        Show finished rooms
      </label>

      {/* Room grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRooms.map((room) => {
          const problem = problems.find((p) => p.id === room.problemId);
          const host = users.find((u) => u.id === room.hostId);
          const isFinished = room.stage === 'finished';

          return (
            <Link key={room.id} to={`/rooms/${room.code}`} className="block">
              <Card padding="p-5" className="hover:border-[var(--primary)]/40 transition-colors">
                {/* Top row: name + stage badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-[var(--text-primary)] leading-snug">
                    {room.name}
                  </h3>
                  <Badge variant={stageBadgeVariant[room.stage]}>{room.stage}</Badge>
                </div>

                {/* Problem title */}
                {problem && (
                  <p className="text-sm text-[var(--text-secondary)] mb-3">{problem.title}</p>
                )}

                {/* Host */}
                {host && (
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar size="sm" name={host.name} />
                    <span className="text-sm text-[var(--text-secondary)]">{host.name}</span>
                  </div>
                )}

                {/* Bottom row: participant count, code, action */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-[var(--text-tertiary)]">
                      {room.participants.length}/{room.maxParticipants} players
                    </span>
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {room.code}
                    </span>
                  </div>

                  <Button variant="secondary" size="sm" onClick={(e) => e.preventDefault()}>
                    {isFinished ? 'View' : 'Join'}
                  </Button>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
