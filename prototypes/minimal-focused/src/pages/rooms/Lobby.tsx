import { Check, ChevronDown, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { problems } from '../../data/problems';
import type { RoomParticipant } from '../../data/rooms';
import { rooms } from '../../data/rooms';
import { currentUser, users } from '../../data/users';
import { toast } from '../../lib/toast';

type BadgeVariant = 'success' | 'warning' | 'info' | 'neutral';

const ROLE_BADGE: Record<string, { label: string; variant: BadgeVariant; className?: string }> = {
  interviewer: { label: 'Interviewer', variant: 'info' },
  candidate: { label: 'Candidate', variant: 'warning' },
  spectator: { label: 'Spectator', variant: 'neutral' },
};

function getUserName(userId: string): string {
  return users.find((u) => u.id === userId)?.name ?? 'Unknown';
}

export function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = rooms.find((r) => r.code === code) ?? rooms[0];
  const problem = room.problemId ? problems.find((p) => p.id === room.problemId) : null;
  const isHost = room.hostId === currentUser.id;

  // Participant list: start with all but last, then add last after 2s
  const allParticipants = room.participants;
  const initialParticipants =
    allParticipants.length > 1 ? allParticipants.slice(0, -1) : allParticipants;
  const lateJoiner =
    allParticipants.length > 1 ? allParticipants[allParticipants.length - 1] : null;

  const [participants, setParticipants] = useState<RoomParticipant[]>(initialParticipants);
  const [joinedVisible, setJoinedVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('javascript');
  const [editorTheme, setEditorTheme] = useState('dark');
  const [timeLimit, setTimeLimit] = useState('30');
  const [aiHints, setAiHints] = useState(false);

  // Simulated late join
  useEffect(() => {
    if (!lateJoiner) return;
    const timer = setTimeout(() => {
      setParticipants((prev) => [...prev, lateJoiner]);
      // Trigger fade-in after render
      requestAnimationFrame(() => setJoinedVisible(true));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Check if all participants are ready (use local isReady for current user)
  const allReady = participants.every((p) => {
    if (p.userId === currentUser.id) return isReady;
    return p.ready;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success('Copied!');
  };

  // Host badge uses accent styling (not a built-in Badge variant)
  function renderRoleBadge(participant: RoomParticipant) {
    if (participant.userId === room.hostId) {
      return (
        <Badge variant="neutral" className="bg-[var(--accent-muted)] text-[var(--accent)]">
          Host
        </Badge>
      );
    }
    const config = ROLE_BADGE[participant.role];
    if (!config) return null;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header Card */}
      <Card padding="p-6">
        {/* Room name */}
        <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">{room.name}</h1>

        {/* Room code with copy */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-mono text-sm text-[var(--accent)]">{room.code}</span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-0.5 rounded hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            aria-label="Copy room code"
          >
            <Copy size={14} className="text-[var(--text-tertiary)] hover:text-[var(--accent)]" />
          </button>
        </div>

        {/* Problem */}
        {problem && (
          <p className="font-mono text-sm text-[var(--text-secondary)] mt-1">{problem.title}</p>
        )}

        {/* Gradient divider */}
        <hr className="mt-4 mb-0 border-0 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

        {/* Participant List */}
        <div className="mt-2">
          <span className="font-mono text-xs text-[var(--text-tertiary)] uppercase tracking-widest">
            // participants
          </span>

          <div className="mt-2">
            {participants.map((p, idx) => {
              const isLateJoiner = lateJoiner && p.userId === lateJoiner.userId;
              const isLast = idx === participants.length - 1;
              const pReady = p.userId === currentUser.id ? isReady : p.ready;

              return (
                <div
                  key={p.userId}
                  className={`flex items-center py-3 ${!isLast ? 'border-b border-[var(--border-default)]' : ''} ${
                    isLateJoiner
                      ? `transition-opacity duration-500 ${joinedVisible ? 'opacity-100' : 'opacity-0'}`
                      : ''
                  }`}
                >
                  <Avatar name={getUserName(p.userId)} size="sm" />
                  <span className="text-sm font-medium text-[var(--text-primary)] ml-2.5">
                    {getUserName(p.userId)}
                  </span>
                  {p.userId === currentUser.id && (
                    <span className="font-mono text-xs text-[var(--accent)] ml-1.5">You</span>
                  )}
                  <div className="ml-2">{renderRoleBadge(p)}</div>
                  {/* Ready indicator */}
                  <div className="ml-auto">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        pReady ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Controls */}
      <div className="mt-6 flex gap-3">
        {/* Ready toggle */}
        <Button
          variant={isReady ? 'primary' : 'secondary'}
          size="md"
          onClick={() => setIsReady(!isReady)}
          className={isReady ? 'shadow-[var(--shadow-accent-glow)]' : ''}
        >
          {isReady && <Check size={16} className="mr-1.5" />}
          {isReady ? 'Ready' : 'Ready Up'}
        </Button>

        {/* Start Session (host only) */}
        {isHost && (
          <Link to={`/rooms/${room.code}/session`}>
            <Button
              variant="primary"
              size="md"
              disabled={!allReady}
              className={allReady ? 'shadow-[var(--shadow-accent-glow)]' : ''}
            >
              Start Session
            </Button>
          </Link>
        )}

        {/* Leave Room */}
        <Button
          variant="ghost"
          size="md"
          className="text-[var(--error)] hover:bg-[rgba(239,68,68,0.1)]"
          onClick={() => navigate('/rooms')}
        >
          Leave Room
        </Button>
      </div>

      {/* Settings Panel */}
      <Card padding="p-0" className="mt-4">
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex items-center justify-between w-full px-5 py-3 cursor-pointer"
        >
          <span className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Settings
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--text-tertiary)] transition-transform duration-200 ${
              settingsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {settingsOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-default)]">
            <div className="pt-4">
              <Select
                label="Language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </Select>
            </div>

            <Select
              label="Editor Theme"
              value={editorTheme}
              onChange={(e) => setEditorTheme(e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>

            {/* Host-only settings */}
            {isHost && (
              <>
                <Select
                  label="Time Limit"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </Select>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">AI Hints</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiHints}
                    onClick={() => setAiHints(!aiHints)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-150 cursor-pointer ${
                      aiHints
                        ? 'bg-[var(--accent)]'
                        : 'bg-[var(--bg-subtle)] border border-[var(--border-default)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
                        aiHints ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
