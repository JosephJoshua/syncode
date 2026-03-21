import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/auth.store';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-gray-900">
        Collaborative Interview Practice
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Practice coding interviews together with real-time collaboration, code execution, and AI
        feedback.
      </p>
      <div className="mt-8">
        <Link
          to="/login"
          className="inline-flex rounded-md bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          {isAuthenticated ? 'Manage session' : 'Log in'}
        </Link>
      </div>
    </div>
  );
}
