import { cn } from '@syncode/ui';
import { ProblemMarkdown } from './problem-markdown.js';

interface ConstraintsBlockProps {
  content: string;
  compact?: boolean;
  className?: string;
  title?: string;
}

export function ConstraintsBlock({
  content,
  compact = false,
  className,
  title,
}: ConstraintsBlockProps) {
  return (
    <section
      className={cn(
        'rounded-lg border border-amber-500/20 border-l-[3px] border-l-amber-400/70 bg-amber-500/5 px-4 py-3',
        className,
      )}
    >
      {title ? (
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
          {title}
        </h3>
      ) : null}
      <ProblemMarkdown content={content} compact={compact} />
    </section>
  );
}
