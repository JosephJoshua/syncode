import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthLayout } from './AuthLayout';

function getStrength(length: number): { level: number; label: string; color: string } {
  if (length === 0) return { level: 0, label: '', color: '' };
  if (length <= 3) return { level: 1, label: 'Weak', color: 'var(--error)' };
  if (length <= 7) return { level: 2, label: 'Fair', color: 'var(--warning)' };
  if (length <= 11) return { level: 3, label: 'Good', color: 'var(--accent)' };
  return { level: 4, label: 'Strong', color: 'var(--success)' };
}

export function Register() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const strength = getStrength(password.length);

  return (
    <AuthLayout>
      <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Create your account</h1>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Input label="Full name" placeholder="Jane Doe" />
        <Input label="Email" type="email" placeholder="you@example.com" />
        <div>
          <Input
            label="Password"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-1 mt-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1 rounded-full flex-1"
                style={{
                  backgroundColor: i < strength.level ? strength.color : 'var(--bg-subtle)',
                }}
              />
            ))}
          </div>
          {strength.label && (
            <p className="text-xs mt-1" style={{ color: strength.color }}>
              {strength.label}
            </p>
          )}
        </div>
        <Input label="Confirm password" type="password" placeholder="********" />
        <Button className="w-full mt-4" onClick={() => navigate('/dashboard')}>
          Create account
        </Button>
      </form>

      <p className="text-sm text-[var(--text-secondary)] text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
