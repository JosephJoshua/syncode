import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function FeedbackShell({
  eyebrow,
  title,
  metaLine,
  badges,
  children,
  sessionId,
}: {
  eyebrow: string;
  title: string;
  metaLine: string;
  badges: ReactNode[];
  children: ReactNode;
  sessionId?: string;
}) {
  const { t } = useTranslation('common');

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-primary/6 blur-[120px]"
      />

      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {t('backToDashboard')}
      </Link>

      <header className="mt-5 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/70">
          {eyebrow}
        </p>

        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">{badges}</div>
        </div>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <p className="font-mono text-sm text-muted-foreground">{metaLine}</p>
          {sessionId ? (
            <>
              <span className="hidden text-border/60 sm:inline">·</span>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">
                {sessionId}
              </p>
            </>
          ) : null}
        </div>
      </header>

      <main className="mt-8">{children}</main>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardHeader className="px-5 pt-6 pb-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="px-5 pb-6 sm:px-6">{children}</CardContent>
    </Card>
  );
}
