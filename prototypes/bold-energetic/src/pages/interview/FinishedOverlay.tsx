import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '../../components/ui/Button.tsx';
import { ProgressRing } from '../../components/ui/ProgressRing.tsx';

function ScoreBar({ label, value }: { label: string; value: number }) {
  const [animatedWidth, setAnimatedWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(value), 200);
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

export function FinishedOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-white/80 dark:bg-black/60">
      <div
        className="max-w-md w-full mx-4 text-center"
        style={{ animation: 'modal-scale-in 0.3s ease-out' }}
      >
        <h1 className="font-display text-3xl font-bold gradient-text mb-8">Session Complete</h1>

        <div className="flex justify-center mb-6">
          <ProgressRing value={88} size={140} strokeWidth={10} />
        </div>

        <div className="space-y-3 mb-8 text-left">
          <ScoreBar label="Problem Solving" value={92} />
          <ScoreBar label="Code Quality" value={85} />
          <ScoreBar label="Communication" value={88} />
        </div>

        <div className="flex flex-col gap-3">
          <Link to="/dashboard/history/s1">
            <Button variant="primary" className="w-full">
              View Detailed Review
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" className="w-full">
              Return to Dashboard
            </Button>
          </Link>
        </div>

        {/* Confetti dots */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                backgroundColor: ['#FF5A5F', '#FF9F1C', '#2EC4B6', '#3B82F6', '#A855F7'][i % 5],
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `confetti ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
