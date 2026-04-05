import { Input } from '@syncode/ui';
import { Search } from 'lucide-react';

export interface ProblemsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProblemsSearchBar({ value, onChange }: ProblemsSearchBarProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground/80" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by problem title"
        aria-label="Search problems"
        className="h-12 rounded-xl border-border/60 bg-card/40 pl-10 backdrop-blur-sm"
      />
    </div>
  );
}
