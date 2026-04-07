import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ProblemsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProblemsSearchBar({ value, onChange }: ProblemsSearchBarProps) {
  const { t } = useTranslation('problems');
  return (
    <div className="problems-search-shell relative rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm transition-colors">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/80" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.ariaLabel')}
        className="h-12 w-full rounded-xl border-0 bg-transparent px-3 py-2.5 pl-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
      />
    </div>
  );
}
