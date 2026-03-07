import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';

function getStrength(password: string): {
  width: string;
  color: string;
} {
  const len = password.length;
  if (len === 0) return { width: '0%', color: 'transparent' };
  if (len <= 3) return { width: '25%', color: 'var(--error)' };
  if (len <= 6) return { width: '50%', color: 'var(--warning)' };
  if (len <= 9) return { width: '75%', color: 'var(--accent)' };
  return { width: '100%', color: 'var(--success)' };
}

export function Register() {
  const [password, setPassword] = useState('');
  const strength = getStrength(password);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
        Create your account
      </h1>
      <p className="text-[var(--text-secondary)] text-sm mt-1">Join thousands of CS students</p>

      <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Input label="Full Name" placeholder="Jane Doe" />
        <Input label="Email" type="email" placeholder="you@example.com" />

        {/* Password with strength bar */}
        <div>
          <Input
            label="Password"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: strength.width,
                backgroundColor: strength.color,
                transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>

        <Input label="Confirm Password" type="password" placeholder="********" />

        <Button variant="primary" className="w-full" type="submit">
          Create Account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link to="/login" className="text-[var(--primary)] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
