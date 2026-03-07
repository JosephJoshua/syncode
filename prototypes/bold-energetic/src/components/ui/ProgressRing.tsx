import { useEffect, useId, useState } from 'react';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({ value, size = 120, strokeWidth = 8 }: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const gradientId = useId();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 50);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-label={`${value}% progress`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF5A5F" />
            <stop offset="100%" stopColor="#FF9F1C" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${CSS.escape(gradientId)})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
      </svg>
      <span
        className={`absolute gradient-text font-display font-bold ${size <= 60 ? 'text-sm' : size <= 90 ? 'text-lg' : 'text-2xl'}`}
      >
        {value}
      </span>
    </div>
  );
}
