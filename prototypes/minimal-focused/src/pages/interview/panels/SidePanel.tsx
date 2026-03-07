import { Lightbulb, Maximize2, MicOff, Minimize2, PanelRightClose, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = 'participants' | 'ai' | 'chat';
type Stage = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

interface SidePanelProps {
  onCollapse: () => void;
  stage?: Stage;
  spectatorMode?: boolean;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const participants = [
  { name: 'Alice Chen', role: 'Host', online: true, isYou: true },
  { name: 'Bob Kim', role: 'Interviewer', online: true, isYou: false },
  { name: 'Carol Wu', role: 'Candidate', online: true, isYou: false },
  { name: 'David Li', role: 'Observer', online: false, isYou: false },
];

const hints = [
  {
    level: 'Level 1: Nudge',
    text: "Think about using a hash map to store values you've already seen.",
  },
  {
    level: 'Level 2: Approach',
    text: 'For each element, check if target - current exists in your map. If not, store the current value and its index.',
  },
  {
    level: 'Level 3: Detailed',
    text: 'Create a Map<number, number>. For each nums[i], compute complement = target - nums[i]. If map.has(complement), return [map.get(complement), i]. Otherwise, map.set(nums[i], i). This runs in O(n).',
  },
];

const chatMessages = [
  { type: 'system' as const, text: 'Alice Chen created the room' },
  { type: 'system' as const, text: 'Bob Kim joined the room' },
  {
    type: 'message' as const,
    name: 'Alice Chen',
    text: 'Hey Bob, ready to start?',
    time: '24:02',
  },
  {
    type: 'message' as const,
    name: 'Bob Kim',
    text: 'Yep, let me pull up the problem.',
    time: '23:58',
  },
  { type: 'system' as const, text: 'Stage changed to Coding' },
  {
    type: 'message' as const,
    name: 'Carol Wu',
    text: "I'll start with a brute force approach first.",
    time: '22:45',
  },
  {
    type: 'message' as const,
    name: 'Alice Chen',
    text: 'Sounds good. Walk us through your thinking.',
    time: '22:30',
  },
  {
    type: 'message' as const,
    name: 'Carol Wu',
    text: "So for each element I need to check every other element... that's O(n^2).",
    time: '21:15',
  },
];

const videoParticipants = [
  { name: 'Alice Chen', micOff: false },
  { name: 'Bob Kim', micOff: true },
  { name: 'Carol Wu', micOff: false },
  { name: 'David Li', micOff: false },
];

// ─── Tab Content Components ─────────────────────────────────────────────────

function ParticipantsTab({ spectatorMode }: { spectatorMode: boolean }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Participant list */}
      <div className="px-3 pt-3">
        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
          // participants
        </span>
      </div>
      <div className="px-3 mt-1">
        {participants.map((p, i) => (
          <div
            key={p.name}
            className={`flex items-center gap-2 py-2.5 ${
              i < participants.length - 1 ? 'border-b border-[var(--border-default)]' : ''
            }`}
          >
            <Avatar name={p.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--text-primary)] truncate">{p.name}</span>
                {p.isYou && <span className="font-mono text-[10px] text-[var(--accent)]">You</span>}
              </div>
              <Badge variant="neutral" className="text-[10px] mt-0.5">
                {p.role}
              </Badge>
            </div>
            <span
              className={`w-2 h-2 rounded-full flex-none ${
                p.online ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Host controls — hidden in spectator mode */}
      {!spectatorMode && (
        <div className="mt-3 px-3 pb-3">
          <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
            // host_controls
          </span>
          <div className="mt-2">
            <Button variant="secondary" size="sm" className="w-full">
              Assign Interviewer
            </Button>
            <Button variant="secondary" size="sm" className="w-full mt-1.5">
              Assign Candidate
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="w-full mt-3 hover:shadow-[var(--shadow-accent-glow)]"
            >
              Advance Stage
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AiTab() {
  const [revealedHints, setRevealedHints] = useState(0);
  const [mounted, setMounted] = useState(false);
  const remaining = hints.length - revealedHints;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hints section */}
      <div className="px-3 pt-3">
        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
          // hints
        </span>
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={remaining === 0}
            onClick={() => setRevealedHints((prev) => Math.min(prev + 1, hints.length))}
          >
            <Lightbulb size={14} className="mr-1.5" />
            Request Hint
          </Button>
        </div>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)] mt-1.5">
          {remaining} hint{remaining !== 1 ? 's' : ''} available
        </p>

        <div className="mt-3 space-y-2">
          {hints.slice(0, revealedHints).map((hint) => (
            <div
              key={hint.level}
              className="bg-[var(--bg-subtle)] rounded-md p-3 border-l-2 border-[var(--accent)]"
            >
              <Badge variant="neutral">{hint.level}</Badge>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 italic">{hint.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Review section */}
      <div className="mt-6 px-3 pb-3">
        <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest">
          // ai_review
        </span>
        <div className="mt-2">
          <span className="font-mono text-3xl font-semibold text-[var(--accent)]">78</span>
          <span className="text-sm text-[var(--text-tertiary)]"> / 100</span>
        </div>

        {/* Category bars */}
        <div className="mt-3 space-y-2">
          {[
            { label: 'Problem Solving', score: 82 },
            { label: 'Code Quality', score: 74 },
            { label: 'Communication', score: 80 },
          ].map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                  {cat.label}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                  {cat.score}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] mt-1">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-700"
                  style={{
                    width: mounted ? `${cat.score}%` : '0%',
                    transitionDelay: '300ms',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Review comment */}
        <div className="bg-[var(--bg-subtle)] rounded-md p-3 mt-3">
          <p className="text-xs text-[var(--text-secondary)] italic">
            Good problem-solving approach. Consider optimizing from O(n^2) to O(n) using a hash map.
            Variable naming is clear and consistent. Communication could be improved by explaining
            trade-offs more explicitly.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatTab() {
  const [messages, setMessages] = useState(chatMessages);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        type: 'message' as const,
        name: 'Alice Chen',
        text,
        time: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      },
    ]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {messages.map((msg, i) =>
          msg.type === 'system' ? (
            <div key={i} className="text-center py-2">
              <span className="font-mono text-[10px] text-[var(--text-tertiary)] italic">
                {msg.text}
              </span>
            </div>
          ) : (
            <div key={i} className="flex gap-2 py-1">
              <Avatar name={msg.name} size="xs" className="mt-0.5 flex-none" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[var(--accent)]">{msg.name}</span>
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                    {msg.time}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{msg.text}</p>
              </div>
            </div>
          ),
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="h-10 flex items-center px-2 gap-2 border-t border-[var(--border-default)] flex-none">
        <input
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-[var(--bg-subtle)] rounded-md text-xs h-7 px-2 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none border-none"
        />
        <button
          type="button"
          onClick={handleSend}
          className="flex items-center justify-center bg-[var(--accent)] rounded-md h-7 w-7 text-[var(--bg-base)] cursor-pointer flex-none"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Floating Draggable Video Strip ──────────────────────────────────────────

function useDrag(elRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const state = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      state.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
      setDragging(true);

      const onMouseMove = (ev: MouseEvent) => {
        let nx = state.current.posX + (ev.clientX - state.current.startX);
        let ny = state.current.posY + (ev.clientY - state.current.startY);

        const el = elRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const baseX = rect.left - nx;
          const baseY = rect.top - ny;
          nx = Math.max(-baseX + 8, Math.min(window.innerWidth - rect.width - baseX - 8, nx));
          ny = Math.max(-baseY + 8, Math.min(window.innerHeight - rect.height - baseY - 8, ny));
        }

        setPos({ x: nx, y: ny });
      };

      const onMouseUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [pos, elRef],
  );

  return { pos, dragging, onMouseDown };
}

function FloatingVideoStrip() {
  const [minimized, setMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { pos, dragging, onMouseDown } = useDrag(containerRef);

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="fixed bottom-3 right-[340px] z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-default)] shadow-md cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        <Maximize2 size={12} className="text-[var(--text-tertiary)]" />
        <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
          {videoParticipants.length} video
        </span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      className={`fixed bottom-3 right-[340px] z-40 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-default)] shadow-lg ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {videoParticipants.map((p) => {
        const initials = p.name
          .split(' ')
          .map((w) => w[0])
          .join('');
        return (
          <div
            key={p.name}
            className="w-14 h-[42px] bg-[var(--bg-subtle)] rounded relative flex items-center justify-center flex-none"
          >
            {p.micOff && (
              <div className="absolute top-0.5 right-0.5">
                <MicOff size={10} className="text-[var(--error)]" />
              </div>
            )}
            <span className="absolute bottom-0.5 left-1 font-mono text-[8px] text-[var(--text-secondary)]">
              {initials}
            </span>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setMinimized(true)}
        className="ml-0.5 p-1 rounded hover:bg-[var(--bg-subtle)] cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        title="Minimize video"
      >
        <Minimize2 size={10} />
      </button>
    </div>
  );
}

// ─── Side Panel ─────────────────────────────────────────────────────────────

const tabs: { key: Tab; label: string }[] = [
  { key: 'participants', label: 'Participants' },
  { key: 'ai', label: 'AI' },
  { key: 'chat', label: 'Chat' },
];

export function SidePanel({ onCollapse, stage = 'coding', spectatorMode = false }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('participants');
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  // Auto-switch to AI tab during wrapup
  useEffect(() => {
    if (stage === 'wrapup') {
      setActiveTab('ai');
    }
  }, [stage]);

  // Simulate an incoming chat message after 5 seconds if chat tab isn't active
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab !== 'chat') {
        setHasUnreadChat(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleTabSwitch = useCallback((key: Tab) => {
    setActiveTab(key);
    if (key === 'chat') {
      setHasUnreadChat(false);
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Floating video strip — rendered outside panel flow */}
      <FloatingVideoStrip />

      {/* Tab bar */}
      <div className="h-9 flex items-center border-b border-[var(--border-default)] bg-[var(--bg-raised)] flex-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabSwitch(tab.key)}
            className={`font-mono text-xs px-3 py-2 cursor-pointer transition-colors relative ${
              activeTab === tab.key
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
            {tab.key === 'chat' && hasUnreadChat && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--success)]" />
            )}
          </button>
        ))}
        <div className="ml-auto pr-1">
          <Button variant="ghost" size="sm" className="p-1" onClick={onCollapse}>
            <PanelRightClose size={16} />
          </Button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'participants' && <ParticipantsTab spectatorMode={spectatorMode} />}
      {activeTab === 'ai' && <AiTab />}
      {activeTab === 'chat' && <ChatTab />}
    </div>
  );
}
