import { createFileRoute } from '@tanstack/react-router';
import { HostControlPanel } from '@/components/host-control-panel';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
      <p className="mt-4 text-muted-foreground mb-8">
        Your interview practice workspace will live here.
      </p>

      {/* Render mock host controls only during local development/UI testing. */}
      {import.meta.env.DEV ? <HostControlPanel /> : null}
    </div>
  );
}
