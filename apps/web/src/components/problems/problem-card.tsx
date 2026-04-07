import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from '@syncode/ui';
import type { ProblemDifficulty, ProblemItem } from './problems.types';

const difficultyBadgeVariant: Record<ProblemDifficulty, 'success' | 'warning' | 'destructive'> = {
  Easy: 'success',
  Medium: 'warning',
  Hard: 'destructive',
};

export interface ProblemCardProps {
  problem: ProblemItem;
  tagNames: string[];
}

export function ProblemCard({ problem, tagNames }: ProblemCardProps) {
  return (
    <Card
      size="sm"
      className="h-full border border-white/[0.035] bg-card/40 ring-border/45 backdrop-blur-sm transition-all duration-200 hover:border-primary/12 hover:ring-primary/20 hover:bg-card/60 hover:shadow-[0_10px_30px_-24px_color-mix(in_oklch,var(--primary)_80%,transparent)]"
    >
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={difficultyBadgeVariant[problem.difficulty]} size="sm">
            {problem.difficulty}
          </Badge>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Progress
              value={problem.acceptanceRate}
              className="h-1.5 w-16 shrink-0 bg-primary/12"
              indicatorClassName="bg-primary shadow-[0_0_14px_-3px_color-mix(in_oklch,var(--primary)_85%,transparent)]"
            />
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {problem.acceptanceRate}%
            </span>
          </div>
        </div>
        <CardTitle className="text-[1.05rem] leading-snug">{problem.title}</CardTitle>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-2">
          {tagNames.map((tagName) => (
            <Badge key={tagName} variant="outline" size="sm" className="text-muted-foreground">
              {tagName}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
