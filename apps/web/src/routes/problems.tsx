import { Card, CardContent } from '@syncode/ui';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/problems')({
  component: ProblemsPage,
});

const MOCK_PROBLEMS = [
  {
    title: 'Two Sum',
    difficulty: 'Easy',
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
  },
  {
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'Medium',
  },
  {
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
  },
];

function ProblemsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Problems</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Browse a lightweight practice set while the full problem list experience is still taking
          shape.
        </p>
      </section>

      <section className="mt-8 sm:mt-10">
        <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
          <CardContent className="px-0 py-0">
            <ul className="divide-y divide-border/40">
              {MOCK_PROBLEMS.map((problem) => (
                <li
                  key={problem.title}
                  className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <span className="font-medium text-foreground">{problem.title}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {problem.difficulty}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
