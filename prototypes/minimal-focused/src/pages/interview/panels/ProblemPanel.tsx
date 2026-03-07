import { ChevronLeft } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { problems } from '../../../data/problems';

// ─── Problem Panel ──────────────────────────────────────────────────────────

interface ProblemPanelProps {
  onCollapse: () => void;
}

const problem = problems[0];

export function ProblemPanel({ onCollapse }: ProblemPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-[var(--border-default)] bg-[var(--bg-raised)] flex-none">
        <span className="font-mono text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Problem
        </span>
        <Button variant="ghost" size="sm" className="p-1" onClick={onCollapse}>
          <ChevronLeft size={14} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Title */}
        <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
          {problem.title}
        </h2>

        {/* Difficulty + Tags */}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={problem.difficulty}>{problem.difficulty}</Badge>
          {problem.tags.map((tag) => (
            <span key={tag} className="font-mono text-xs text-[var(--text-tertiary)]">
              {tag}
            </span>
          ))}
        </div>

        {/* Divider */}
        <hr className="mt-3 mb-3 border-0 h-px bg-gradient-to-r from-[var(--border-default)] via-[var(--border-strong)] to-transparent" />

        {/* Description */}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
          {problem.description}
        </p>

        {/* Examples */}
        <div className="mt-4">
          {problem.examples.map((example, i) => (
            <div key={i} className="border-l-2 border-[var(--accent)] pl-3 mb-3">
              <span className="font-mono text-xs text-[var(--accent)]">Example {i + 1}</span>

              <div className="mt-1">
                <span className="font-mono text-xs text-[var(--text-tertiary)]">Input:</span>
                <div className="bg-[var(--bg-subtle)] rounded p-2 font-mono text-xs text-[var(--text-primary)] mt-0.5">
                  {example.input}
                </div>
              </div>

              <div className="mt-1">
                <span className="font-mono text-xs text-[var(--text-tertiary)]">Output:</span>
                <div className="bg-[var(--bg-subtle)] rounded p-2 font-mono text-xs text-[var(--text-primary)] mt-0.5">
                  {example.output}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Constraints */}
        <div className="mt-4">
          <span className="font-mono text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
            Constraints
          </span>
          <ul className="mt-2 space-y-1.5">
            {problem.constraints.map((constraint, i) => (
              <li
                key={i}
                className="flex items-start gap-2 font-mono text-xs text-[var(--text-secondary)]"
              >
                <span className="w-1 h-1 rounded-full bg-[var(--accent)] inline-block mt-1.5 flex-none" />
                {constraint}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
