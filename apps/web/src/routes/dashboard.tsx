import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
      <p className="mt-4 text-gray-600">Your interview practice workspace will live here.</p>
    </div>
  );
}
