import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
  Separator,
} from '@syncode/ui';
import { useTranslation } from 'react-i18next';
import {
  DIFFICULTY_OPTIONS,
  type ProblemDifficulty,
  type ProblemStatus,
  STATUS_OPTIONS,
} from './problems.types';
import type { ProblemTagInfo } from './problems-tags';

interface FilterOptionProps {
  id: string;
  label: string;
  checked: boolean;
  count?: number;
  onCheckedChange: () => void;
}

function FilterOption({ id, label, checked, count, onCheckedChange }: FilterOptionProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm transition-colors hover:bg-muted/35"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <Label htmlFor={id} className="cursor-pointer font-normal text-muted-foreground">
          {label}
        </Label>
      </span>
      {typeof count === 'number' ? (
        <span className="font-mono text-[11px] text-muted-foreground/50">{count}</span>
      ) : null}
    </label>
  );
}

export interface ProblemsFilterSidebarProps {
  selectedDifficulties: ProblemDifficulty[];
  selectedStatuses: ProblemStatus[];
  selectedTags: string[];
  difficultyCounts: Record<ProblemDifficulty, number>;
  statusCounts: Record<ProblemStatus, number>;
  popularTags: ProblemTagInfo[];
  onToggleDifficulty: (value: ProblemDifficulty) => void;
  onToggleStatus: (value: ProblemStatus) => void;
  onToggleTag: (value: string) => void;
  onClearAll: () => void;
}

export function ProblemsFilterSidebar({
  selectedDifficulties,
  selectedStatuses,
  selectedTags,
  difficultyCounts,
  statusCounts,
  popularTags,
  onToggleDifficulty,
  onToggleStatus,
  onToggleTag,
  onClearAll,
}: ProblemsFilterSidebarProps) {
  const { t } = useTranslation('problems');
  return (
    <Card className="overflow-hidden border border-white/4 bg-card/35 ring-border/45 backdrop-blur-sm lg:h-188 lg:self-stretch">
      <CardHeader className="border-b border-white/4 pb-1.5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm tracking-tight">{t('filter.heading')}</CardTitle>
          <Button variant="ghost" size="xs" onClick={onClearAll}>
            {t('filter.resetAll')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="problems-sidebar-scroll space-y-2 pt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted-foreground/60 uppercase">
              {t('filter.difficulty')}
            </h2>
          </div>
          <div className="space-y-1">
            {DIFFICULTY_OPTIONS.map((difficulty) => (
              <FilterOption
                key={difficulty}
                id={`difficulty-${difficulty}`}
                label={difficulty}
                checked={selectedDifficulties.includes(difficulty)}
                count={difficultyCounts[difficulty]}
                onCheckedChange={() => onToggleDifficulty(difficulty)}
              />
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted-foreground/60 uppercase">
            {t('filter.problemStatus')}
          </h2>
          <div className="space-y-1">
            {STATUS_OPTIONS.map((status) => (
              <FilterOption
                key={status}
                id={`status-${status}`}
                label={status === 'Todo' ? t('filter.todoNotDone') : status}
                checked={selectedStatuses.includes(status)}
                count={statusCounts[status]}
                onCheckedChange={() => onToggleStatus(status)}
              />
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-2">
          <h2 className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted-foreground/60 uppercase">
            {t('filter.popularTags')}
          </h2>
          <div className="space-y-1">
            {popularTags.map((tag) => (
              <FilterOption
                key={tag.slug}
                id={`tag-${tag.slug}`}
                label={tag.name}
                checked={selectedTags.includes(tag.slug)}
                count={tag.count}
                onCheckedChange={() => onToggleTag(tag.slug)}
              />
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
