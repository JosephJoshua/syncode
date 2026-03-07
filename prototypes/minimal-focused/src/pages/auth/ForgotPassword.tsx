import { Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from './AuthLayout';

export function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
          >
            <Check className="h-6 w-6 text-[var(--success)]" />
          </div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Check your email</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            We've sent a password reset link to your email.
          </p>
          <Link
            to="/login"
            className="inline-block mt-4 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Reset your password</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Enter your email and we'll send you a reset link.
      </p>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Input label="Email" type="email" placeholder="you@example.com" />
        <Button className="w-full mt-4" onClick={() => setSubmitted(true)}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
