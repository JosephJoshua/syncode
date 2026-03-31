import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Register</h1>
      <p className="mt-4 text-gray-600">Your registration flow will live here.</p>
    </div>
  );
}
