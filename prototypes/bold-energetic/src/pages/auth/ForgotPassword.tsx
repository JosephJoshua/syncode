import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';

export function ForgotPassword() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="text-center">
        <CheckCircle2 size={48} className="mx-auto text-[var(--success)]" />
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] mt-4">
          Check your email
        </h1>
        <p className="text-[var(--text-secondary)] text-sm mt-2">
          We've sent a password reset link to your email
        </p>
        <Link
          to="/login"
          className="inline-block mt-6 text-sm text-[var(--primary)] font-medium hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Reset your password
      </h1>
      <p className="text-[var(--text-secondary)] text-sm mt-1">
        Enter your email and we'll send you a reset link
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <Input label="Email" type="email" placeholder="you@example.com" />

        <Button variant="primary" className="w-full" type="submit">
          Send Reset Link
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">
        Remember your password?{' '}
        <Link to="/login" className="text-[var(--primary)] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
