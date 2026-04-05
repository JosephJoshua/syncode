import { Button } from '@syncode/ui';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { MOCK_PROBLEMS } from '@/components/problems/problems.mock';

export const Route = createFileRoute('/problems/$problemId')({
  loader: ({ params }) => {
    const problem = MOCK_PROBLEMS.find((item) => item.id === params.problemId);

    if (!problem) {
      throw notFound();
    }

    return problem;
  },
  component: ProblemDetailsPage,
});

function ProblemDetailsPage() {
  const problem = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <div className="max-w-3xl space-y-5">
        <Button asChild variant="ghost" size="sm">
          <Link to="/problems">
            <ArrowLeft className="size-4" />
            Back to Problems
          </Link>
        </Button>

        <div className="space-y-3">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            Problem Details
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {problem.title}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">Problem ID: {problem.id}</p>
        </div>
      </div>
    </div>
  );
}
