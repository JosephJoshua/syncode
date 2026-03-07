import { Link } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';

export function Login() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Welcome back</h1>
      <p className="text-[var(--text-secondary)] text-sm mt-1">Sign in to continue practicing</p>

      <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Input label="Email" type="email" placeholder="you@example.com" />
        <div>
          <Input label="Password" type="password" placeholder="********" />
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot-password" className="text-xs text-[var(--primary)] hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button variant="primary" className="w-full" type="submit">
          Sign In
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <hr className="border-[var(--border-default)]" />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-card)] px-3 text-xs text-[var(--text-tertiary)]">
          or continue with
        </span>
      </div>

      {/* Social login */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary">Google</Button>
        <Button variant="secondary">GitHub</Button>
      </div>

      {/* Bottom link */}
      <p className="mt-8 text-center text-sm text-[var(--text-secondary)]">
        Don't have an account?{' '}
        <Link to="/register" className="text-[var(--primary)] font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
