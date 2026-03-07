import Editor from '@monaco-editor/react';
import { Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { problems } from '../../data/problems';
import { sessions } from '../../data/sessions';
import { users } from '../../data/users';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setOffset(circumference - (score / 100) * circumference);
    });
    return () => cancelAnimationFrame(timer);
  }, [score, circumference]);

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{
            transition: 'stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            filter: 'drop-shadow(0 0 8px rgba(0, 229, 153, 0.3))',
          }}
        />
      </svg>
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: 120, height: 120 }}
      >
        <span className="text-2xl font-mono font-bold text-[var(--accent)]">{score}</span>
        <span className="text-sm font-mono text-[var(--text-tertiary)]">/ 100</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, value }: { label: string; value: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <span className="text-sm font-mono text-[var(--text-secondary)]">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-subtle)]">
        <div
          className="h-2 rounded-full bg-[var(--accent)]"
          style={{
            width: mounted ? `${value}%` : '0%',
            transition: 'width 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '300ms',
          }}
        />
      </div>
    </div>
  );
}

const timelineEvents = [
  { time: '0:00', description: 'Session started' },
  { time: '8:32', description: 'Hint requested (Level 1)' },
  { time: '18:45', description: 'Code submitted' },
  { time: '19:12', description: 'All tests passed' },
  { time: '35:00', description: 'Session ended' },
];

const feedbackItems = [
  {
    category: 'Problem Solving',
    variant: 'success' as const,
    text: 'Good approach using a hash map for O(n) time complexity. Identified the key insight quickly and translated it into working code without unnecessary steps.',
  },
  {
    category: 'Code Quality',
    variant: 'info' as const,
    text: 'Variable names are clear and the code is well-structured. Consider adding edge case handling for empty inputs and documenting the time/space complexity.',
  },
  {
    category: 'Communication',
    variant: 'warning' as const,
    text: 'Explained the brute force approach well but could improve by walking through the optimized solution step-by-step before coding. Practice thinking aloud more consistently.',
  },
];

function monacoLanguage(lang: string) {
  if (lang === 'python') return 'python';
  if (lang === 'typescript') return 'typescript';
  return 'javascript';
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const session = sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">Session not found.</p>
        <Link
          to="/dashboard/sessions"
          className="text-[var(--accent)] hover:underline text-sm mt-2 inline-block font-mono"
        >
          back_to_sessions
        </Link>
      </div>
    );
  }

  const problem = problems.find((p) => p.id === session.problemId);
  const partner = users.find((u) => u.id === session.partnerId);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="text-sm font-mono">
        <Link
          to="/dashboard/sessions"
          className="text-[var(--accent)] hover:underline transition-colors"
        >
          sessions
        </Link>
        <span className="text-[var(--text-tertiary)]"> / </span>
        <span className="text-[var(--text-tertiary)]">{problem?.title ?? 'detail'}</span>
      </div>

      {/* Header */}
      <div className="mt-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)] tracking-tight">
            {problem?.title ?? 'Unknown Problem'}
          </h2>
          <Badge variant="neutral">
            <span className="font-mono">{session.duration}m</span>
          </Badge>
        </div>
        <p className="text-sm font-mono text-[var(--text-secondary)] mt-1">
          {formatDate(session.date)}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Avatar name={partner?.name} size="sm" />
          <span className="text-sm text-[var(--text-secondary)]">{partner?.name ?? 'Unknown'}</span>
          <Badge variant="neutral" className="capitalize ml-1">
            {session.role}
          </Badge>
        </div>
      </div>

      {/* Score Section */}
      <Card className="mt-6">
        <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start">
          <div className="relative flex-shrink-0">
            <ScoreRing score={session.scores.overall} />
          </div>
          <div className="flex-1 w-full space-y-4">
            <CategoryBar label="Problem Solving" value={session.scores.problemSolving} />
            <CategoryBar label="Code Quality" value={session.scores.codeQuality} />
            <CategoryBar label="Communication" value={session.scores.communication} />
          </div>
        </div>
      </Card>

      {/* Code Snapshot */}
      <Card className="mt-6">
        <p className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">
          Final Code
        </p>
        <div className="rounded-md overflow-hidden border border-[var(--border-default)]">
          <Editor
            height="300px"
            language={monacoLanguage(session.language)}
            value={session.codeSnapshot}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              fontFamily: "'IBM Plex Mono', monospace",
              lineNumbers: 'on',
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: { vertical: 'hidden' },
            }}
          />
        </div>
      </Card>

      {/* AI Feedback */}
      <Card className="mt-6">
        <p className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">
          AI Review
        </p>
        <div className="space-y-3">
          {feedbackItems.map((item) => (
            <div key={item.category} className="bg-[var(--bg-subtle)] p-4 rounded-md">
              <Badge variant={item.variant} className="mb-2">
                {item.category}
              </Badge>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      <Card className="mt-6">
        <p className="font-display text-sm font-semibold text-[var(--text-primary)] mb-4">
          Session Timeline
        </p>
        <div className="border-l-2 border-[var(--border-default)] ml-3 space-y-4">
          {timelineEvents.map((event) => (
            <div key={event.time} className="relative pl-5">
              <div
                className="absolute w-2.5 h-2.5 rounded-full bg-[var(--accent)] -left-[6px] top-0.5"
                style={{ boxShadow: '0 0 8px rgba(0, 229, 153, 0.4)' }}
              />
              <p className="text-xs font-mono text-[var(--accent)]">{event.time}</p>
              <p className="text-sm text-[var(--text-secondary)]">{event.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Replay Preview */}
      <Card className="mt-6">
        <p className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">
          Session Replay
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">
            <Play size={14} className="mr-1" />
            Play
          </Button>
          <input
            type="range"
            min="0"
            max="100"
            defaultValue="0"
            className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--bg-subtle)] accent-[var(--accent)] cursor-pointer"
          />
        </div>
        <p className="text-xs font-mono text-[var(--text-tertiary)] mt-2">
          // replay is simulated in this design preview
        </p>
      </Card>
    </div>
  );
}
