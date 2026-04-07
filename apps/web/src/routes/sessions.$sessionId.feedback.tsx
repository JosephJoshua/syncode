import { Card, CardContent } from '@syncode/ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { requireAuth } from '@/lib/auth';
import { fetchDashboardSessionHistory } from '@/lib/dashboard-session-history';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/sessions/$sessionId/feedback')({
  beforeLoad: requireAuth,
  component: SessionFeedbackPage,
});

function SessionFeedbackPage() {
  const { t } = useTranslation('feedback');
  const { sessionId } = Route.useParams();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const sessionHistoryQuery = useQuery({
    queryKey: ['dashboard', 'session-history', userId],
    enabled: Boolean(userId),
    queryFn: () => fetchDashboardSessionHistory(userId!),
  });
  const session = sessionHistoryQuery.data?.rows.find((item) => item.id === sessionId);

  if (!session) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        <section className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('heading')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t('notFound.description')}
          </p>
        </section>

        <Card className="mt-8 border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-6 py-8">
            <p className="text-sm text-muted-foreground">
              {t('notFound.invalidSessionId', { sessionId })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('heading')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t('found.description')}</p>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-6 py-6 sm:px-7">
            <div className="border-b border-border/40 pb-5">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {t('label.sessionFeedback')}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {session.problemName}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('placeholder', { sessionId: session.id, problemName: session.problemName })}
              </p>
            </div>

            <div className="space-y-5 pt-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('label.summary')}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('placeholder', { sessionId: session.id, problemName: session.problemName })}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">{t('label.focusAreas')}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>{t('focusItems.clarify')}</li>
                  <li>{t('focusItems.pacing')}</li>
                  <li>{t('focusItems.explanation')}</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t('label.nextIteration')}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('nextIteration')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-6 py-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {t('details.heading')}
            </p>

            <dl className="mt-5 space-y-4">
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('details.sessionId')}
                </dt>
                <dd className="text-sm font-medium text-foreground">{session.id}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('details.role')}
                </dt>
                <dd className="text-sm font-medium capitalize text-foreground">{session.role}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('details.date')}
                </dt>
                <dd className="text-sm font-medium text-foreground">{session.date}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('details.duration')}
                </dt>
                <dd className="text-sm font-medium text-foreground">{session.durationMinutes}m</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
