import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@syncode/ui';
import { X } from 'lucide-react';
import { type ProblemSortKey, SORT_OPTIONS } from './problems.mock';

const activeFilterCyan = 'rgb(34 211 238)';
const activeFilterCyanSoft = 'rgb(34 211 238 / 0.16)';
const activeFilterCyanBorder = 'rgb(34 211 238 / 0.28)';

export interface ActiveFilterItem {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface ProblemsResultsToolbarProps {
  activeFilters: ActiveFilterItem[];
  sort: ProblemSortKey;
  onSortChange: (value: ProblemSortKey) => void;
  onClearAll: () => void;
}

export function ProblemsResultsToolbar({
  activeFilters,
  sort,
  onSortChange,
  onClearAll,
}: ProblemsResultsToolbarProps) {
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/30 p-4 backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            Active Filters
          </p>
          {hasActiveFilters ? (
            <Button variant="ghost" size="xs" onClick={onClearAll}>
              Clear all
            </Button>
          ) : null}
        </div>
        {hasActiveFilters ? (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <Badge
                key={filter.id}
                variant="secondary"
                size="sm"
                className="gap-1.5 border-transparent"
                style={{
                  backgroundColor: activeFilterCyanSoft,
                  borderColor: activeFilterCyanBorder,
                  color: activeFilterCyan,
                }}
              >
                <span>{filter.label}</span>
                <button
                  type="button"
                  onClick={filter.onRemove}
                  className="inline-flex size-3.5 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                  style={{ color: activeFilterCyan }}
                  aria-label={`Remove ${filter.label}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No filters applied yet.</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-48">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
          Sort by
        </p>
        <Select value={sort} onValueChange={(value) => onSortChange(value as ProblemSortKey)}>
          <SelectTrigger className="h-10 rounded-xl border-border/60 bg-background/70">
            <SelectValue placeholder="Select sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
