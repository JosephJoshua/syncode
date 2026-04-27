import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@syncode/ui';
import type { ReactNode } from 'react';

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
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
      <header className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {badges}
        </div>

        <p className="font-mono text-sm text-muted-foreground sm:text-base">{metaLine}</p>

        {sessionId ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Session {sessionId}
          </p>
        ) : null}
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
