import { BookOpen, Code2, Mic, Play, RotateCcw, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { fadeIn, fadeInUp, staggeredEntrance } from '../lib/animations';

const features = [
  {
    icon: Code2,
    title: 'Real-time Collaboration',
    description: 'Edit code together with live cursors, see changes instantly across the wire.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Feedback',
    description: 'Get intelligent hints and detailed code reviews after every session.',
  },
  {
    icon: Play,
    title: 'Sandboxed Execution',
    description: 'Run code safely in isolated containers. No setup, no risk.',
  },
  {
    icon: RotateCcw,
    title: 'Session Replay',
    description: 'Review past sessions keystroke-by-keystroke to track improvement.',
  },
  {
    icon: BookOpen,
    title: 'Problem Library',
    description: 'Curated problems across all difficulty levels, tagged and searchable.',
  },
  {
    icon: Mic,
    title: 'Voice Chat',
    description: 'Communicate naturally with built-in low-latency voice.',
  },
];

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)]">
      {/* Top nav bar */}
      <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <span className="font-display text-lg font-bold text-[var(--text-primary)] tracking-tight">
          <span className="text-[var(--accent)]">Syn</span>Code
        </span>
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="text-sm font-mono text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            demo
          </Link>
          <Link
            to="/login"
            className="text-sm font-mono text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            sign_in
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center relative px-6">
        {/* Dot grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none dot-grid-lg"
          style={{ opacity: 0.15 }}
        />

        {/* Radial accent glow behind hero */}
        <div
          className="absolute top-1/2 left-1/2 w-[600px] h-[600px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--accent-muted) 0%, transparent 70%)',
            animation: 'glowPulse 4s ease-in-out infinite',
          }}
        />

        <div className="relative z-[1] flex flex-col items-center text-center max-w-3xl">
          <p
            className="font-mono text-xs text-[var(--accent)] tracking-widest uppercase mb-6"
            style={fadeIn(200)}
          >
            Collaborative Interview Training
          </p>
          <h1
            className="font-display text-5xl md:text-7xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.05]"
            style={fadeInUp(300)}
          >
            Practice coding
            <br />
            interviews <span className="font-mono text-[var(--accent)]">together</span>
          </h1>
          <p
            className="text-lg text-[var(--text-secondary)] mt-6 max-w-lg leading-relaxed"
            style={fadeInUp(500)}
          >
            Real-time collaboration, AI feedback, and sandboxed execution — everything you need to
            ace your next interview.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center" style={fadeInUp(700)}>
            <Link to="/register">
              <Button variant="primary" size="lg">
                Get Started
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="secondary" size="lg">
                View Demo
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="lg"
              onClick={() =>
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              Learn More
            </Button>
          </div>
        </div>

        {/* Blinking cursor instead of chevron */}
        <div
          className="absolute bottom-8 font-mono text-2xl text-[var(--accent)]"
          style={{ animation: 'blink 1.2s step-end infinite' }}
        >
          _
        </div>
      </section>

      {/* Decorative divider */}
      <div className="max-w-5xl mx-auto w-full px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
      </div>

      {/* Features Section */}
      <section id="features" className="py-24 max-w-5xl mx-auto px-6">
        <p className="font-mono text-xs text-[var(--accent)] tracking-widest uppercase mb-2">
          // feature_set
        </p>
        <h2 className="font-display text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Everything you need
        </h2>
        <p className="text-base text-[var(--text-secondary)] mt-2 mb-16">
          Built for serious practice
        </p>

        {/* Hero feature — full width, larger */}
        <div className="mb-12" style={staggeredEntrance(0, 100)}>
          <Card
            padding="p-0"
            className="overflow-hidden group hover:border-[var(--border-strong)] transition-all duration-200"
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
              <div className="md:col-span-2 bg-[var(--accent-muted)] flex items-center justify-center p-12">
                <Code2
                  size={64}
                  className="text-[var(--accent)] transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <div className="md:col-span-3 p-8 flex flex-col justify-center">
                <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-2">
                  01
                </p>
                <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
                  {features[0].title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed max-w-md">
                  {features[0].description}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Remaining features — alternating 2-column rows */}
        <div className="space-y-4">
          {features.slice(1).map((feature, i) => {
            const isReversed = i % 2 === 1;
            const num = String(i + 2).padStart(2, '0');
            return (
              <Card
                key={feature.title}
                padding="p-6"
                className="group hover:border-[var(--border-strong)] transition-all duration-200"
                style={staggeredEntrance(i + 1, 100)}
              >
                <div className={`flex items-center gap-6 ${isReversed ? 'flex-row-reverse' : ''}`}>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] transition-all duration-200 group-hover:shadow-[var(--shadow-accent-glow)]">
                    <feature.icon size={24} />
                  </div>
                  <div className={isReversed ? 'text-right flex-1' : 'flex-1'}>
                    <div
                      className="flex items-baseline gap-3"
                      style={isReversed ? { justifyContent: 'flex-end' } : {}}
                    >
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                        {num}
                      </span>
                      <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                        {feature.title}
                      </h3>
                    </div>
                    <p
                      className={`text-sm text-[var(--text-secondary)] mt-1 leading-relaxed ${isReversed ? 'ml-auto' : ''}`}
                      style={{ maxWidth: '28rem' }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-default)] py-12 mt-auto">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <span className="font-display text-sm font-bold text-[var(--text-primary)] tracking-tight">
                <span className="text-[var(--accent)]">Syn</span>Code
              </span>
              <p className="text-xs text-[var(--text-tertiary)] mt-2 leading-relaxed">
                Collaborative interview training for CS students.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
                Product
              </p>
              <div className="space-y-2">
                <Link
                  to="/problems"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Problems
                </Link>
                <Link
                  to="/rooms"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Rooms
                </Link>
                <Link
                  to="/dashboard"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Account */}
            <div>
              <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
                Account
              </p>
              <div className="space-y-2">
                <Link
                  to="/login"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Register
                </Link>
                <Link
                  to="/profile"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Profile
                </Link>
              </div>
            </div>

            {/* Dev */}
            <div>
              <p className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
                Dev
              </p>
              <div className="space-y-2">
                <Link
                  to="/dev"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Component Gallery
                </Link>
                <Link
                  to="/admin"
                  className="block text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Admin Panel
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-[var(--border-default)] flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              &copy; 2026 SynCode
            </span>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">
              Design Reference A — Minimal & Focused
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
