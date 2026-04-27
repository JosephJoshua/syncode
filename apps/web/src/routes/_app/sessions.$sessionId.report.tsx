import { CONTROL_API, type SessionDetail } from '@syncode/contracts';
import { Badge, Button, Card, CardContent, Progress } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client.js';

export const Route = createFileRoute('/_app/sessions/$sessionId/report')({
  component: SessionReportPage,
});

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function SessionReportPage() {
  const { t } = useTranslation('sessionReport');
  const { sessionId } = Route.useParams();
  const sessionQuery = useQuery({
    queryKey: ['session-report', sessionId],
    queryFn: () => api(CONTROL_API.SESSIONS.GET, { params: { id: sessionId } }),
  });

  if (sessionQuery.isLoading) {
    return <StateView title={t('loading.title')} description={t('loading.description')} />;
  }

  if (sessionQuery.isError) {
    return (
      <StateView title={t('error.title')} description={t('error.description')}>
        <Button
          variant="outline"
          onClick={() => {
            sessionQuery.refetch().catch(() => undefined);
          }}
        >
          {t('error.retry')}
        </Button>
      </StateView>
    );
  }

  const session = sessionQuery.data;
  if (!session?.report) {
    return <StateView title={t('empty.title')} description={t('empty.description')} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t('backToDashboard')}
      </Link>

      <section className="mt-6 max-w-3xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          <FileText className="size-8 text-primary" />
          {session.problem?.title ?? t('heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('subheading')}</p>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
        <ScorePanel session={session} />
        <CorrectnessPanel session={session} />
      </section>

      <section className="mt-6">
        <DetailsPanel session={session} />
      </section>
    </div>
  );
}

function StateView({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

function ScorePanel({ session }: { readonly session: SessionDetail }) {
  const { t } = useTranslation('sessionReport');
  const report = session.report;
  if (!report) return null;

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6 sm:px-7">
        <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {t('score.overall')}
            </p>
            <p className="mt-3 text-5xl font-semibold tracking-tight text-primary">
              {report.overallScore}
            </p>
          </div>
          <p className="max-w-44 text-right text-xs leading-5 text-muted-foreground">
            {t('score.generatedAt')}: {formatDate(report.generatedAt)}
          </p>
        </div>

        <div className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t('score.breakdown')}
          </h2>
          {Object.entries(report.categoryScores).map(([category, score]) => (
            <div className="space-y-2" key={category}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">
                  {t(`score.categories.${category}`, { defaultValue: formatCategory(category) })}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{score}</span>
              </div>
              <Progress value={score} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CorrectnessPanel({ session }: { readonly session: SessionDetail }) {
  const { t } = useTranslation('sessionReport');
  const latest = session.submissions.at(-1);
  const passed = latest?.passed ?? 0;
  const total = latest?.total ?? 0;
  const correctnessScore = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {t('correctness.title')}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {session.submissions.length === 0
                ? t('correctness.empty')
                : t('correctness.summary', { passed, total })}
            </h2>
          </div>
          <p className="text-4xl font-semibold tracking-tight text-primary">{correctnessScore}</p>
        </div>

        <div className="mt-6">
          <Progress value={correctnessScore} />
        </div>

        {session.submissions.length > 0 ? (
          <div className="mt-6 space-y-3">
            {session.submissions.map((submission) => {
              const completed = submission.status === 'completed';
              return (
                <div
                  className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={submission.submissionId}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t('correctness.submission')} {submission.submissionId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(submission.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={completed ? 'success' : 'destructive'}>
                      {completed ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <XCircle className="size-3" />
                      )}
                      {completed ? t('correctness.completed') : t('correctness.failed')}
                    </Badge>
                    <span className="font-mono text-sm text-muted-foreground">
                      {t('correctness.summary', {
                        passed: submission.passed,
                        total: submission.total,
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailsPanel({ session }: { readonly session: SessionDetail }) {
  const { t } = useTranslation('sessionReport');
  const report = session.report;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    feedback: true,
    strengths: true,
    improvements: false,
  });
  if (!report) return null;

  const sections = [
    { id: 'feedback', title: t('details.feedback'), content: report.feedback },
    { id: 'strengths', title: t('details.strengths'), items: report.strengths },
    {
      id: 'improvements',
      title: t('details.improvements'),
      items: report.areasForImprovement,
    },
  ];

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6 sm:px-7">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t('details.title')}
        </h2>
        <div className="mt-5 divide-y divide-border/50 rounded-md border border-border/60">
          {sections.map((section) => {
            const isOpen = openSections[section.id] ?? false;
            const panelId = `report-section-${section.id}`;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  aria-controls={panelId}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/40"
                  onClick={() =>
                    setOpenSections((current) => ({
                      ...current,
                      [section.id]: !isOpen,
                    }))
                  }
                >
                  {section.title}
                  {isOpen ? (
                    <ChevronDown className="size-4 text-primary" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen ? (
                  <div id={panelId} className="px-4 pb-4 text-sm leading-6 text-muted-foreground">
                    {'content' in section ? (
                      <p>{section.content || t('details.none')}</p>
                    ) : section.items.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{t('details.none')}</p>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

function formatCategory(value: string) {
  return value
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}
