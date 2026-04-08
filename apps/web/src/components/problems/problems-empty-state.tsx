import { Button, Card, CardContent } from '@syncode/ui';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ProblemsEmptyStateProps {
  variant: 'library' | 'filtered';
  onReset?: () => void;
}

export function ProblemsEmptyState({ variant, onReset }: ProblemsEmptyStateProps) {
  const { t } = useTranslation('problems');
  const title = variant === 'library' ? t('empty.libraryTitle') : t('empty.filteredTitle');
  const description =
    variant === 'library' ? t('empty.libraryDescription') : t('empty.filteredDescription');

  return (
    <Card className="border-dashed border-border/70 bg-card/30 py-0 backdrop-blur-sm">
      <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/70 text-primary">
          <SearchX className="size-5" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        {onReset ? (
          <Button variant="outline" className="mt-6" onClick={onReset}>
            {t('empty.clearFilters')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
