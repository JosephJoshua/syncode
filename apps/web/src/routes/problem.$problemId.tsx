import { createFileRoute } from '@tanstack/react-router';
import { ProblemDetailLayout } from '@/components/problems/problem-detail-layout';
import { ApiError } from '@/lib/api-client';
import { useProblemDetailQuery } from '@/lib/problems/problem-detail';

export const Route = createFileRoute('/problem/$problemId')({
  component: ProblemDetailRouteComponent,
});

function ProblemDetailRouteComponent() {
  const { problemId } = Route.useParams();

  return <ProblemDetailPage problemId={problemId} />;
}

export function ProblemDetailPage({ problemId }: { problemId: string }) {
  const problemDetailQuery = useProblemDetailQuery(problemId);

  if (problemDetailQuery.isPending) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-2xl border border-border/60 bg-card/60 px-6 py-12">
          <p className="text-sm text-muted-foreground">Loading problem details...</p>
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
  if (error instanceof ApiError) {
    return {
      statusLabel: `${error.response.statusCode} Error`,
      title: error.response.message,
      message:
        error.response.statusCode === 404
          ? 'The requested problem could not be found for this URL.'
          : 'We could not load this problem right now.',
    };
  }

  if (error instanceof Error) {
    return {
      statusLabel: 'Request Error',
      title: 'Unable to load problem details',
      message: error.message,
    };
  }

  return {
    statusLabel: 'Request Error',
    title: 'Unable to load problem details',
    message: 'An unexpected error occurred while loading this problem.',
  };
}
