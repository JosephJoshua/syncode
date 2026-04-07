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
import { useTranslation } from 'react-i18next';
import { type ProblemSortKey, SORT_OPTIONS } from './problems.types';

const activeFilterColor = 'var(--primary)';
const activeFilterSoft = 'color-mix(in oklch, var(--primary) 16%, transparent)';
const activeFilterBorder = 'color-mix(in oklch, var(--primary) 28%, transparent)';

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
  const { t } = useTranslation('problems');
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/30 p-4 backdrop-blur-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            {t('toolbar.activeFilters')}
          </p>
          {hasActiveFilters ? (
            <Button variant="ghost" size="xs" onClick={onClearAll}>
              {t('toolbar.clearAll')}
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
                  backgroundColor: activeFilterSoft,
                  borderColor: activeFilterBorder,
                  color: activeFilterColor,
                }}
              >
                <span>{filter.label}</span>
                <button
                  type="button"
                  onClick={filter.onRemove}
                  className="inline-flex size-3.5 items-center justify-center rounded-full transition-colors hover:bg-white/5"
                  style={{ color: activeFilterColor }}
                  aria-label={`Remove ${filter.label}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('toolbar.noFilters')}</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-56 sm:shrink-0 sm:self-start sm:pl-3 sm:pr-1 sm:pt-1">
        <p className="px-1 font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
          {t('toolbar.sortBy')}
        </p>
        <Select value={sort} onValueChange={(value) => onSortChange(value as ProblemSortKey)}>
          <SelectTrigger className="h-11 rounded-2xl border-white/[0.05] bg-background/80">
            <SelectValue placeholder="Select sort" />
          </SelectTrigger>
          <SelectContent align="end" sideOffset={8}>
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
