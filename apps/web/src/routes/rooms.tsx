import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/rooms')({
  component: RoomsPage,
});

function RoomsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-12">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Rooms</h1>
    </div>
  );
}
