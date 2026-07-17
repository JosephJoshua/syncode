import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

const CIRCLE_SIZE = 150;
const STROKE_WIDTH = 10;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clampScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function ReportScoreSummary({
  overallScore,
  items,
}: {
  overallScore: number | null | undefined;
  items: Array<{
    key: string;
    label: string;
    score: number;
  }>;
}) {
  const normalizedScore = clampScore(overallScore);
  const progress = CIRCUMFERENCE - (normalizedScore / 100) * CIRCUMFERENCE;

  return (
    <section className="overflow-hidden rounded-[28px] border border-border/50 bg-card/80 px-5 py-6 backdrop-blur-sm sm:px-6 sm:py-7">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          AI Summary
        </p>
      </div>

      <div className="grid items-center gap-8 md:grid-cols-[170px_minmax(0,1fr)]">
        <div className="flex justify-center md:justify-start">
          <div className="relative flex size-[150px] items-center justify-center">
            <motion.div
              className="absolute inset-3 rounded-full bg-emerald-400/10 blur-2xl"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
            <svg
              aria-hidden="true"
              className="absolute inset-0 -rotate-90"
              focusable="false"
              height={CIRCLE_SIZE}
              width={CIRCLE_SIZE}
              viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
            >
              <circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                fill="none"
                r={RADIUS}
                stroke="rgba(148,163,184,0.28)"
                strokeWidth={STROKE_WIDTH}
              />
              <motion.circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                fill="none"
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: progress }}
                r={RADIUS}
                stroke="#62f0a8"
                strokeLinecap="round"
                strokeWidth={STROKE_WIDTH}
                style={{ strokeDasharray: CIRCUMFERENCE }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              />
            </svg>

            <div className="relative z-10 rounded-full bg-card/80 px-6 py-5 text-center">
              <motion.p
                className="text-4xl font-semibold tracking-tight text-emerald-300"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.25 }}
              >
                {Math.round(normalizedScore)}
              </motion.p>
              <motion.p
                className="mt-1 font-mono text-xs tracking-[0.18em] text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.35 }}
              >
                / 100
              </motion.p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const score = clampScore(item.score);

            return (
              <motion.div
                key={item.key}
                className="space-y-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 + index * 0.08 }}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-foreground sm:text-base">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{Math.round(score)}%</p>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-muted/65">
                  <motion.div
                    className="h-full rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(98,240,168,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{
                      duration: 0.9,
                      delay: 0.3 + index * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
