import { CONTROL_API, type SessionDetail, type SessionPeerFeedback } from '@syncode/contracts';
import { Badge, Button, Card, CardContent, Progress } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, Code2, MessageSquareText, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StarterCodeBlock } from '@/components/problems/starter-code-block.js';
import { api } from '@/lib/api-client.js';

export const Route = createFileRoute('/_app/sessions/$sessionId')({
  component: SessionDetailPage,
});

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function SessionDetailPage() {
  const { t } = useTranslation('sessionDetail');
  const { t: tDashboard } = useTranslation('dashboard');
  const { sessionId } = Route.useParams();
  const sessionQuery = useQuery({
    queryKey: ['session-detail', sessionId],
    queryFn: () => api(CONTROL_API.SESSIONS.GET, { params: { id: sessionId } }),
  });

  if (sessionQuery.isLoading) {
    return <StateView title={t('loading.title')} description={t('loading.description')} />;
  }

  if (sessionQuery.isError) {
    return (
      <StateView title={t('error.title')} description={t('error.description')}>
        <Button variant="outline" onClick={() => void sessionQuery.refetch()}>
          {t('error.retry')}
        </Button>
      </StateView>
    );
  }

  const session = sessionQuery.data;
  if (!session) {
    return <StateView title={t('notFound.title')} description={t('notFound.description')} />;
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
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {session.problem?.title ?? t('heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('subheading')}</p>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <ReportPanel session={session} />
          <TestResultsPanel session={session} />
          <CodeSnapshotPanel session={session} />
        </div>

        <div className="space-y-6">
          <OverviewPanel session={session} />
          <ParticipantsPanel session={session} roleLabel={tDashboard} />
          <PeerFeedbackPanel feedback={session.peerFeedback} />
        </div>
      </section>
    </div>
  );
}

function StateView({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

function OverviewPanel({ session }: { session: SessionDetail }) {
  const { t } = useTranslation('sessionDetail');
  const rows = [
    [t('overview.problem'), session.problem?.title ?? t('overview.unknown')],
    [t('overview.difficulty'), session.problem?.difficulty ?? t('overview.unknown')],
    [t('overview.mode'), session.mode],
    [t('overview.language'), session.language ?? t('overview.unknown')],
    [t('overview.duration'), t('overview.seconds', { count: session.duration })],
    [t('overview.started'), formatDate(session.createdAt)],
    [
      t('overview.finished'),
      session.finishedAt ? formatDate(session.finishedAt) : t('overview.unknown'),
    ],
  ] as const;

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t('overview.title')}
        </h2>
        <dl className="mt-5 space-y-4">
          {rows.map(([label, value]) => (
            <div className="space-y-1" key={label}>
              <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function ReportPanel({ session }: { session: SessionDetail }) {
  const { t } = useTranslation('sessionDetail');
  const report = session.report;

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6 sm:px-7">
        <div className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {t('report.title')}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {report ? t('report.overallScore') : t('report.empty')}
            </h2>
          </div>
          {report ? (
            <div className="text-right">
              <p className="text-4xl font-semibold tracking-tight text-primary">
                {report.overallScore}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('report.generatedAt')}: {formatDate(report.generatedAt)}
              </p>
            </div>
          ) : null}
        </div>

        {report ? (
          <div className="space-y-6 pt-6">
            <section>
              <h3 className="text-sm font-semibold text-foreground">{t('report.summary')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{report.feedback}</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('report.categoryScores')}
              </h3>
              {Object.entries(report.categoryScores).map(([category, score]) => (
                <div className="space-y-2" key={category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{formatCategory(category)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{score}</span>
                  </div>
                  <Progress value={score} />
                </div>
              ))}
            </section>

            <ListSection title={t('report.strengths')} items={report.strengths} />
            <ListSection title={t('report.improvements')} items={report.areasForImprovement} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TestResultsPanel({ session }: { session: SessionDetail }) {
  const { t } = useTranslation('sessionDetail');

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6 sm:px-7">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t('tests.title')}</h2>
        {session.submissions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('tests.empty')}</p>
        ) : (
          <div className="mt-5 space-y-3">
            {session.submissions.map((submission) => {
              const completed = submission.status === 'completed';
              return (
                <div
                  className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={submission.submissionId}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t('tests.submission')} {submission.submissionId}
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
                      {completed ? t('tests.completed') : t('tests.failed')}
                    </Badge>
                    <span className="font-mono text-sm text-muted-foreground">
                      {t('tests.passed', { passed: submission.passed, total: submission.total })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CodeSnapshotPanel({ session }: { session: SessionDetail }) {
  const { t } = useTranslation('sessionDetail');
  const snapshot = session.latestCodeSnapshot;

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <Code2 className="size-5 text-primary" />
            {t('code.title')}
          </h2>
          {snapshot ? <Badge variant="outline">{snapshot.language}</Badge> : null}
        </div>

        {snapshot ? (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>
                {t('code.capturedAt')}: {formatDate(snapshot.createdAt)}
              </span>
              <span>
                {t('code.trigger')}: {snapshot.trigger}
              </span>
              {snapshot.linesOfCode == null ? null : (
                <span>{t('code.lines', { count: snapshot.linesOfCode })}</span>
              )}
            </div>
            <StarterCodeBlock code={snapshot.code} language={snapshot.language} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{t('code.empty')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ParticipantsPanel({
  session,
  roleLabel,
}: {
  session: SessionDetail;
  roleLabel: (key: string) => string;
}) {
  const { t } = useTranslation('sessionDetail');

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t('participants.title')}
        </h2>
        <div className="mt-5 space-y-4">
          {session.participants.map((participant) => (
            <div
              className="rounded-md border border-border/60 bg-background/45 p-3"
              key={participant.userId}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">
                  {participant.displayName ?? participant.username}
                </p>
                <Badge variant={participant.role}>{roleLabel(`role.${participant.role}`)}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('participants.joined')}: {formatDate(participant.joinedAt)}
              </p>
              {participant.leftAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('participants.left')}: {formatDate(participant.leftAt)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PeerFeedbackPanel({ feedback }: { feedback: SessionPeerFeedback[] }) {
  const { t } = useTranslation('sessionDetail');

  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardContent className="px-6 py-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <MessageSquareText className="size-5 text-primary" />
          {t('feedback.title')}
        </h2>
        {feedback.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('feedback.empty')}</p>
        ) : (
          <div className="mt-5 space-y-4">
            {feedback.map((item) => (
              <FeedbackCard feedback={item} key={item.id} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackCard({ feedback }: { feedback: SessionPeerFeedback }) {
  const { t } = useTranslation('sessionDetail');
  const ratings = [
    [t('feedback.ratings.problemSolving'), feedback.problemSolvingRating],
    [t('feedback.ratings.communication'), feedback.communicationRating],
    [t('feedback.ratings.codeQuality'), feedback.codeQualityRating],
    [t('feedback.ratings.debugging'), feedback.debuggingRating],
    [t('feedback.ratings.overall'), feedback.overallRating],
  ] as const;

  return (
    <div className="rounded-md border border-border/60 bg-background/45 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-foreground">
            {t('feedback.reviewerToCandidate', {
              reviewer: feedback.reviewerName,
              candidate: feedback.candidateName,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(feedback.createdAt)}</p>
        </div>
        <Badge variant={feedback.wouldPairAgain ? 'success' : 'warning'}>
          {feedback.wouldPairAgain ? t('feedback.wouldPairAgain') : t('feedback.wouldNotPairAgain')}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ratings.map(([label, value]) => (
          <div className="flex items-center justify-between gap-3 text-sm" key={label}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono text-foreground">{value}/5</span>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <TextBlock title={t('feedback.strengths')} value={feedback.strengths} />
        <TextBlock title={t('feedback.improvements')} value={feedback.improvements} />
      </div>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
      <p className="mt-1 leading-6 text-foreground/90">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

function formatCategory(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
