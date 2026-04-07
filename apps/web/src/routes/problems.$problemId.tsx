import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ProblemDetailLayout } from '@/components/problems/problem-detail-layout.js';
import { ApiError } from '@/lib/api-client.js';
import i18n from '@/lib/i18n.js';
import { useProblemDetailQuery } from '@/lib/problems/problem-detail.js';

export const Route = createFileRoute('/problems/$problemId')({
  component: ProblemDetailRouteComponent,
});

function ProblemDetailRouteComponent() {
  const { problemId } = Route.useParams();

  return <ProblemDetailPage problemId={problemId} />;
}

export function ProblemDetailPage({ problemId }: { problemId: string }) {
  const { t } = useTranslation('problems');
  const problemDetailQuery = useProblemDetailQuery(problemId);

  if (problemDetailQuery.isPending) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-2xl border border-border/60 bg-card/60 px-6 py-12">
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (problemDetailQuery.isError) {
    const errorCopy = getProblemDetailErrorCopy(problemDetailQuery.error);

    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-8">
          <p className="text-sm font-medium text-destructive">{errorCopy.statusLabel}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {errorCopy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {errorCopy.message}
          </p>
        </div>
      </div>
    );
  }

  return <ProblemDetailLayout problem={problemDetailQuery.data} />;
}

function getProblemDetailErrorCopy(error: unknown) {
  const t = (key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { ns: 'problems', ...options });

  if (error instanceof ApiError) {
    return {
      statusLabel: t('error.withStatusCode', { statusCode: error.response.statusCode }),
      title: error.response.message,
      message: error.response.statusCode === 404 ? t('error.notFound') : t('error.cannotLoad'),
    };
  }

  if (error instanceof Error) {
    return {
      statusLabel: t('error.requestError'),
      title: t('error.unableToLoad'),
      message: error.message,
    };
  }

  return {
    statusLabel: t('error.requestError'),
    title: t('error.unableToLoad'),
    message: t('error.unexpected'),
  };
}
