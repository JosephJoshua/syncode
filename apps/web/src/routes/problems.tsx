import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/problems')({
  component: ProblemsPage,
});

function ProblemsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Problems</h1>
    </div>
  );
}
