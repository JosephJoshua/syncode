import Editor from '@monaco-editor/react';
import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../../components/ui/Avatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { ProgressRing } from '../../components/ui/ProgressRing.tsx';
import { problems } from '../../data/problems.ts';
import { sessions } from '../../data/sessions.ts';
import { users } from '../../data/users.ts';

const getProblem = (id: string) => problems.find((p) => p.id === id);
const getUser = (id: string) => users.find((u) => u.id === id);

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type TabKey = 'code' | 'feedback' | 'timeline';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'code', label: 'Code' },
  { key: 'feedback', label: 'AI Feedback' },
  { key: 'timeline', label: 'Timeline' },
];

interface ScoreBarProps {
  label: string;
  value: number;
}

function ScoreBar({ label, value }: ScoreBarProps) {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(value), 50);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
        <div
          className="h-2 rounded-full gradient-brand"
          style={{
            width: `${animatedWidth}%`,
            transition: 'width 800ms ease-out',
          }}
        />
      </div>
    </div>
  );
}

const feedbackCards = [
  {
    title: 'Approach',
    content:
      'Your two-pointer approach was efficient and showed strong algorithmic thinking. You correctly identified the optimal time complexity and explained the trade-offs well.',
    borderColor: 'var(--gradient-cool-start, #1a1a2e)',
    borderClass: 'border-l-4',
    borderStyle: { borderLeftColor: '#2D3A8C' },
  },
  {
    title: 'Code Quality',
    content:
      'Clean variable naming and good use of built-in data structures. Consider adding edge case handling for empty inputs and documenting your function parameters.',
    borderColor: 'var(--primary)',
    borderClass: 'border-l-4',
    borderStyle: { borderLeftColor: 'var(--primary)' },
  },
  {
    title: 'Communication',
    content:
      'You explained your thought process clearly throughout the session. Good job walking through examples before coding and verifying your solution step by step.',
    borderClass: 'border-l-4',
    borderStyle: { borderLeftColor: 'var(--success)' },
  },
];

const timelineEvents = [
  { time: '0:00', description: 'Session started' },
  { time: '2:30', description: 'Discussed approach' },
  { time: '5:15', description: 'Started coding' },
  { time: '18:00', description: 'First solution attempt' },
  { time: '35:00', description: 'Session ended' },
];

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('code');

  const session = sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Session not found.</p>
        <Link
          to="/dashboard/history"
          className="text-sm text-[var(--primary)] hover:underline mt-2 inline-block"
        >
          Back to History
        </Link>
      </div>
    );
  }

  const problem = getProblem(session.problemId);
  const partner = getUser(session.partnerId);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-[var(--text-secondary)]">
        <Link to="/dashboard/history" className="hover:text-[var(--primary)] transition-colors">
          History
        </Link>
        <span className="mx-2">/</span>
        <span>{problem?.title ?? 'Unknown'}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold">{problem?.title ?? 'Unknown Problem'}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className="text-sm text-[var(--text-secondary)]">{formatDate(session.date)}</span>
          <Badge variant="neutral">{session.duration} min</Badge>
          <div className="flex items-center gap-1.5">
            <Avatar size="xs" name={partner?.name} />
            <span className="text-sm text-[var(--text-secondary)]">
              {partner?.name ?? 'Unknown'}
            </span>
          </div>
          <Badge variant={session.role === 'candidate' ? 'info' : 'neutral'}>{session.role}</Badge>
        </div>
      </div>

      {/* Score Section */}
      <Card>
        <div className="flex flex-col items-center mb-6">
          <ProgressRing value={session.scores.overall} size={120} strokeWidth={8} />
          <p className="text-sm text-[var(--text-secondary)] mt-2">Overall Score</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreBar label="Problem Solving" value={session.scores.problemSolving} />
          <ScoreBar label="Code Quality" value={session.scores.codeQuality} />
          <ScoreBar label="Communication" value={session.scores.communication} />
        </div>
      </Card>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 bg-[var(--bg-subtle)] rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm transition-all duration-200 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[var(--bg-card)] shadow-xs text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'code' && (
            <div className="rounded-xl overflow-hidden border border-[var(--border-default)]">
              <Editor
                height="400px"
                language={session.language}
                value={session.codeSnapshot}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                }}
              />
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-3">
              {feedbackCards.map((card) => (
                <Card key={card.title} className={card.borderClass} style={card.borderStyle}>
                  <h3 className="font-medium mb-2">{card.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {card.content}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="relative ml-4">
              <div className="absolute left-0 top-0 bottom-0 border-l-2 border-[var(--border-default)]" />
              <div className="space-y-6">
                {timelineEvents.map((event) => (
                  <div key={event.time} className="relative flex items-start gap-4 pl-6">
                    <div
                      className="absolute left-0 top-1 -translate-x-1/2 w-2 h-2 rounded-full gradient-brand"
                      style={{ marginLeft: '1px' }}
                    />
                    <div>
                      <span className="text-xs font-mono text-[var(--text-tertiary)]">
                        {event.time}
                      </span>
                      <p className="text-sm text-[var(--text-primary)]">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replay Section */}
      <Card>
        <h3 className="font-medium mb-3">Session Replay</h3>
        <div className="flex items-center gap-4">
          <Button variant="primary" size="sm">
            <Play size={14} className="mr-1.5" />
            Play
          </Button>
          <div className="flex-1 h-2 rounded-full bg-[var(--bg-subtle)]">
            <div className="h-2 rounded-full gradient-brand w-0" />
          </div>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] italic mt-2">
          Design preview — replay is simulated
        </p>
      </Card>
    </div>
  );
}
