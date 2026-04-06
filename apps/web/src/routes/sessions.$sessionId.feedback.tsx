import { Card, CardContent } from '@syncode/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { buildDashboardSessionHistory } from '@/lib/dashboard-session-history';
import { MOCK_SESSION_HISTORY_RESPONSE } from '@/lib/session-history.mock';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/sessions/$sessionId/feedback')({
  component: SessionFeedbackPage,
});

function SessionFeedbackPage() {
  const { sessionId } = Route.useParams();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const session = useMemo(
    () =>
      buildDashboardSessionHistory(MOCK_SESSION_HISTORY_RESPONSE, userId).rows.find(
        (item) => item.id === sessionId,
      ),
    [userId, sessionId],
  );

  if (!session) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
        <section className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Feedback Display
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            This session could not be found, so the feedback placeholder cannot be displayed yet.
          </p>
        </section>

        <Card className="mt-8 border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-6 py-8">
            <p className="text-sm text-muted-foreground">Invalid session id: {sessionId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Feedback Display
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Review the current placeholder layout for this session-specific feedback display.
        </p>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-6 py-6 sm:px-7">
            <div className="border-b border-border/40 pb-5">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Session Feedback
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                {session.problemName}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This placeholder stands in for the fixed feedback layout that will later render real
                session-specific review content.
              </p>
            </div>

            <div className="space-y-5 pt-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Session {session.id} currently uses placeholder commentary tailored to{' '}
                  {session.problemName}. The final version will replace this block with structured,
                  session-specific feedback content.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Focus Areas</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Clarify problem framing and edge-case communication.</li>
                  <li>Improve pacing when reasoning through the solution path.</li>
                  <li>Strengthen explanation quality during tradeoff discussion.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Next Iteration</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use this space later for concrete, session-bound recommendations, code review
                  notes, and communication feedback.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-6 py-6">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Session Details
            </p>

            <dl className="mt-5 space-y-4">
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Session ID
                </dt>
                <dd className="text-sm font-medium text-foreground">{session.id}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Role</dt>
                <dd className="text-sm font-medium capitalize text-foreground">{session.role}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Date</dt>
                <dd className="text-sm font-medium text-foreground">{session.date}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Duration
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
