import { Check, ChevronDown, ChevronUp, Copy, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { problems } from '../../data/problems.ts';
import { users } from '../../data/users.ts';
import { StageBar } from './StageBar.tsx';

const problem = problems[0]; // Two Sum
const filledSlots = [
  { user: users[0], role: 'interviewer' as const, ready: true, color: '#FF5A5F' },
  { user: users[1], role: 'candidate' as const, ready: false, color: '#3B82F6' },
];

interface LobbyStageProps {
  onAdvance: () => void;
}

export function LobbyStage({ onAdvance }: LobbyStageProps) {
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('python');
  const [aiHints, setAiHints] = useState(true);

  const handleCopy = () => {
    void navigator.clipboard.writeText('ROOM01');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
      {/* Stage Bar */}
      <div className="flex justify-center mb-8">
        <StageBar currentStage="waiting" onAdvance={onAdvance} />
      </div>

      {/* Room Info Card */}
      <Card className="mb-6 text-center">
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
          Practice Room Alpha
        </h2>

        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="font-mono text-2xl tracking-widest bg-[var(--bg-subtle)] rounded-lg px-4 py-2 text-[var(--text-primary)]">
            ROOM01
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer text-[var(--text-secondary)]"
            title="Copy room code"
          >
            {copied ? <Check size={18} className="text-[var(--success)]" /> : <Copy size={18} />}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-sm text-[var(--text-secondary)]">Problem:</span>
          <span className="text-sm font-medium text-[var(--text-primary)]">{problem.title}</span>
          <Badge variant="easy">Easy</Badge>
        </div>
      </Card>

      {/* Participant Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {filledSlots.map((slot) => (
          <Card
            key={slot.user.id}
            className="relative"
            style={{ borderLeftWidth: 4, borderLeftColor: slot.color }}
          >
            <div className="flex items-center gap-3">
              <Avatar size="lg" name={slot.user.name} />
              <div className="min-w-0">
                <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                  {slot.user.name}
                </p>
                <Badge variant={slot.role === 'candidate' ? 'info' : 'neutral'} className="mt-1">
                  {slot.role}
                </Badge>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: slot.ready ? 'var(--success)' : 'var(--warning)' }}
                  />
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {slot.ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {/* Empty slots */}
        {[0, 1].map((i) => (
          <div
            key={`empty-${i}`}
            className="rounded-xl border-2 border-dashed border-[var(--border-default)] p-5 flex items-center justify-center"
          >
            <span className="text-sm text-[var(--text-tertiary)]">Waiting for player...</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3">
        <Button
          variant={isReady ? 'primary' : 'secondary'}
          className="w-full max-w-xs"
          onClick={() => setIsReady(!isReady)}
        >
          {isReady ? 'Ready!' : 'Click to Ready Up'}
        </Button>

        <Button
          variant="primary"
          className="w-full max-w-xs"
          disabled={!isReady}
          onClick={onAdvance}
        >
          Start Session
        </Button>

        <Link to="/rooms/join">
          <Button variant="ghost" size="sm">
            Leave Room
          </Button>
        </Link>
      </div>

      {/* Settings */}
      <Card className="mt-6">
        <button
          type="button"
          className="w-full flex items-center justify-between cursor-pointer"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Settings size={16} />
            Settings
          </div>
          {settingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {settingsOpen && (
          <div className="mt-4 space-y-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </Select>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--text-primary)]">AI Hints</span>
              <button
                type="button"
                onClick={() => setAiHints(!aiHints)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                  aiHints ? 'bg-[var(--primary)]' : 'bg-[var(--bg-subtle)]'
                }`}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{ transform: aiHints ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
