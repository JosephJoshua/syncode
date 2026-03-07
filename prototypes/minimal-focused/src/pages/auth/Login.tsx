import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from './AuthLayout';

export function Login() {
  const navigate = useNavigate();
  const [showError, setShowError] = useState(false);

  return (
    <AuthLayout>
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Sign in to your account</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Welcome back</p>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={showError ? 'Invalid email or password' : undefined}
        />
        <div>
          <Input label="Password" type="password" placeholder="********" />
          <div className="text-right mt-1">
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <Button className="w-full mt-4" onClick={() => navigate('/dashboard')}>
          Sign in
        </Button>
      </form>

      <p className="text-sm text-[var(--text-secondary)] text-center mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
