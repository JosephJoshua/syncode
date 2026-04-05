import { defineRoute } from '@syncode/contracts';
import { Button } from '@syncode/ui';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import {
  getMockProblemsListResponse,
  type ProblemsListQuery,
  type ProblemsListResponse,
} from '@/components/problems/problems-list.mock';
import { api } from '@/lib/api-client';

const PROBLEMS_LIST_LIMIT = 100;
const useMockProblemCards = import.meta.env.VITE_PROBLEMS_CARDS_USE_MOCK_SESSIONS === 'true';
const problemsListRoute = defineRoute<ProblemsListQuery, ProblemsListResponse>()('problems', 'GET');

async function fetchProblemsList() {
  if (useMockProblemCards) {
    return getMockProblemsListResponse({ limit: PROBLEMS_LIST_LIMIT });
  }

  return api(problemsListRoute, {
    query: { limit: PROBLEMS_LIST_LIMIT },
  });
}

export const Route = createFileRoute('/problems/$problemId')({
  loader: async ({ params }) => {
    const response = await fetchProblemsList();
    const problem = response.data.find((item) => item.id === params.problemId);

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
