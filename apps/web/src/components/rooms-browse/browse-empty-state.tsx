import { Button } from '@syncode/ui';
import { Link } from '@tanstack/react-router';
import { Compass, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

type Props = {
  readonly isFiltered: boolean;
  readonly onClearFilters: () => void;
};

export function BrowseEmptyState({ isFiltered, onClearFilters }: Props) {
  const { t } = useTranslation('rooms');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-20 text-center backdrop-blur-sm"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/15 blur-2xl" />
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border/60 bg-card text-primary">
          <Compass size={28} />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{t('browse.emptyState.title')}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {t('browse.emptyState.subtitle')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {isFiltered && (
          <Button variant="outline" onClick={onClearFilters}>
            {t('browse.emptyState.clearFilters')}
          </Button>
        )}
        <Link to="/rooms/create">
          <Button className="gap-2 shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.5)]">
            <Plus size={16} />
            {t('browse.emptyState.createRoom')}
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
