import { Badge } from '@syncode/ui';
import { FileText, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ProblemData {
  title: string;
  difficulty: string;
  tags: string[];
  description: string;
  constraints: string | null;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
}

const DIFFICULTY_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
};

interface RoomProblemPanelProps {
  problem: ProblemData | null;
  loading: boolean;
  error: string | null;
  hasProblem: boolean;
}

export function RoomProblemPanel({ problem, loading, error, hasProblem }: RoomProblemPanelProps) {
  const { t } = useTranslation('rooms');

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('problem.heading')}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasProblem ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={24} className="mb-3 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">{t('problem.noProblem')}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : problem ? (
          <ProblemContent problem={problem} />
        ) : null}
      </div>
    </div>
  );
}

function ProblemContent({ problem }: { problem: ProblemData }) {
  const { t } = useTranslation('rooms');

  return (
    <div className="space-y-4">
      {/* Title + difficulty */}
      <div>
        <h2 className="text-sm font-semibold text-foreground">{problem.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant={DIFFICULTY_VARIANT[problem.difficulty] ?? 'neutral'} size="sm">
            {problem.difficulty}
          </Badge>
          {problem.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Description */}
      <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {problem.description}
      </div>

      {/* Examples */}
      {problem.examples.length > 0 ? (
        <div className="space-y-2.5">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('problem.examples')}
          </h3>
          {problem.examples.map((example) => (
            <div
              key={`${example.input}:${example.output}`}
              className="space-y-1.5 rounded border-l-2 border-primary/40 bg-muted/40 p-2.5"
            >
              <div>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  {t('problem.input')}
                </span>
                <pre className="mt-0.5 rounded bg-background p-1.5 font-mono text-[11px] text-foreground/80">
                  {example.input}
                </pre>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  {t('problem.output')}
                </span>
                <pre className="mt-0.5 rounded bg-background p-1.5 font-mono text-[11px] text-foreground/80">
                  {example.output}
                </pre>
              </div>
              {example.explanation ? (
                <p className="text-[11px] italic text-muted-foreground">{example.explanation}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Constraints */}
      {problem.constraints ? (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('problem.constraints')}
          </h3>
          <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {problem.constraints}
          </div>
        </div>
      ) : null}
    </div>
  );
}
