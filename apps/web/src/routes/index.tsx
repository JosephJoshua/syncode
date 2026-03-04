import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">
        Collaborative Interview Practice
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Practice coding interviews together with real-time collaboration, code execution, and AI
        feedback.
      </p>
    </div>
  );
}
