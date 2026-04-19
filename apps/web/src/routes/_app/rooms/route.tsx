import { Button, cn } from '@syncode/ui';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Plus, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/_app/rooms')({
  component: RoomsLayout,
});

function RoomsLayout() {
  const { t } = useTranslation('rooms');

  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const tabs = [
    { label: t('tabs.myRooms'), to: '/rooms', isActive: pathname === '/rooms' },
    {
      label: t('tabs.browse'),
      to: '/rooms/browse',
      isActive: pathname === '/rooms/browse',
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <motion.div
        className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Radio size={20} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('heading')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('layout.sub')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/rooms/create">
            <Button className="gap-2 shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.5)]">
              <Plus size={18} />
              {t('button.createRoom')}
            </Button>
          </Link>
        </div>
      </motion.div>

      <nav
        aria-label={t('tabs.ariaLabel')}
        className="mb-6 flex items-center gap-0.5 border-b border-border/60 sm:gap-1"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={tab.isActive ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex h-9 items-center border-b-2 px-3 text-sm font-medium transition-colors sm:px-4',
              tab.isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
