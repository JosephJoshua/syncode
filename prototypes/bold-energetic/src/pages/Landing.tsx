import { BookOpen, Code2, Mic, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { fadeInUp, staggeredEntrance } from '../lib/animations.ts';

/* ─── Count-up hook ──────────────────────────────────────────── */
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const animate = useCallback(() => {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          animate();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);

  return { value, ref };
}

/* ─── Features data ──────────────────────────────────────────── */
const features = [
  {
    icon: Code2,
    title: 'Real-time Collaboration',
    description:
      'Code together in real-time with CRDT-powered collaborative editing. See cursors, selections, and changes as they happen.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Feedback',
    description:
      'Get instant AI reviews on your code quality, time complexity, and interview-readiness with actionable suggestions.',
  },
  {
    icon: Play,
    title: 'Sandboxed Execution',
    description:
      'Run code safely in isolated containers with support for multiple languages, custom inputs, and real-time output.',
  },
  {
    icon: RotateCcw,
    title: 'Session Replay',
    description:
      'Review past sessions frame-by-frame. Replay every keystroke, discussion, and decision to learn from your practice.',
  },
  {
    icon: BookOpen,
    title: 'Problem Library',
    description:
      'Curated collection of interview problems organized by topic and difficulty. From arrays to dynamic programming.',
  },
  {
    icon: Mic,
    title: 'Voice Chat',
    description:
      'Built-in voice communication so you can discuss approaches, ask clarifying questions, and simulate real interviews.',
  },
];

/* ─── Stats data ─────────────────────────────────────────────── */
const stats = [
  { target: 10000, label: 'Sessions Completed', suffix: '+' },
  { target: 500, label: 'Practice Problems', suffix: '+' },
  { target: 2000, label: 'Active Users', suffix: '+' },
  { target: 48, label: 'User Rating', suffix: '', decimals: 1 },
];

function StatItem({ target, label, suffix, decimals }: (typeof stats)[number]) {
  const { value, ref } = useCountUp(target);
  const display = decimals ? (value / 10).toFixed(decimals) : value.toLocaleString();

  return (
    <div ref={ref} className="text-center">
      <div className="font-display text-4xl font-bold gradient-text">
        {display}
        {suffix}
      </div>
      <div className="text-sm text-[var(--text-secondary)] mt-1">{label}</div>
    </div>
  );
}

/* ─── Landing Page ───────────────────────────────────────────── */
export function Landing() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-10 transition-all duration-300 ${
          scrolled ? 'bg-[var(--bg-card)] shadow-[var(--shadow-sm)]' : ''
        }`}
      >
        <Link
          to="/"
          className={`font-display text-xl font-bold transition-colors duration-300 ${scrolled ? 'gradient-text' : 'text-white'}`}
        >
          SynCode
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className={`text-sm font-medium transition-colors ${scrolled ? 'text-[var(--text-secondary)] hover:text-[var(--primary)]' : 'text-white hover:text-white/80'}`}
          >
            Demo
          </Link>
          <Link
            to="/login"
            className={`text-sm font-medium transition-colors ${scrolled ? 'text-[var(--text-secondary)] hover:text-[var(--primary)]' : 'text-white hover:text-white/80'}`}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className={`inline-flex items-center justify-center rounded-xl text-sm font-semibold px-5 h-10 transition-colors ${
              scrolled
                ? 'gradient-brand text-white hover:shadow-[var(--shadow-glow-primary)]'
                : 'bg-white text-[var(--primary)] hover:bg-white/90'
            }`}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative gradient-brand min-h-screen flex items-center justify-center overflow-hidden">
        {/* Decorative blobs */}
        <div
          className="absolute top-[15%] left-[10%] w-72 h-72 rounded-full bg-white/10"
          style={{ animation: 'float 6s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-[20%] right-[8%] w-96 h-96 rounded-full bg-white/10"
          style={{ animation: 'float 6s ease-in-out infinite 2s' }}
        />
        <div
          className="absolute top-[45%] right-[30%] w-48 h-48 rounded-full bg-white/5"
          style={{ animation: 'float 6s ease-in-out infinite 4s' }}
        />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center" style={fadeInUp()}>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight">
            Master Coding Interviews Together
          </h1>
          <p className="mt-6 text-lg text-white/80 max-w-xl mx-auto">
            Real-time collaboration, AI feedback, and sandboxed execution — everything you need to
            ace your next interview.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-xl bg-white text-[var(--primary)] font-semibold px-8 py-3 shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              Start Practicing
            </Link>
            <button
              type="button"
              onClick={scrollToFeatures}
              className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-transparent text-white font-semibold px-8 py-3 hover:bg-white/10 transition-all duration-200 cursor-pointer"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="bg-[var(--bg-base)] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold gradient-text">
              Everything you need
            </h2>
            <p className="mt-3 text-[var(--text-secondary)]">Built for serious practice</p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">
            {/* Hero feature — spans 2 columns, taller */}
            <div
              className="md:col-span-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-8 flex flex-col justify-between min-h-[280px] group hover:border-[var(--primary-light)] hover:shadow-[var(--shadow-md)] transition-all duration-300"
              style={staggeredEntrance(0)}
            >
              <div>
                <div className="w-14 h-14 rounded-xl gradient-brand flex items-center justify-center mb-6 shadow-[var(--shadow-glow-primary)] group-hover:scale-105 transition-transform duration-300">
                  <Code2 size={28} className="text-white" />
                </div>
                <h3 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                  {features[0].title}
                </h3>
                <p className="mt-3 text-[var(--text-secondary)] leading-relaxed max-w-lg">
                  {features[0].description}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
                <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                Live &bull; CRDT-powered
              </div>
            </div>

            {/* Feature 2 — standard, single column */}
            <div
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-6 flex flex-col min-h-[280px] group hover:border-[var(--primary-light)] hover:shadow-[var(--shadow-md)] transition-all duration-300"
              style={staggeredEntrance(1)}
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Sparkles size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {features[1].title}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed flex-1">
                {features[1].description}
              </p>
            </div>

            {/* Feature 3 — standard */}
            <div
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-6 flex flex-col group hover:border-[var(--primary-light)] hover:shadow-[var(--shadow-md)] transition-all duration-300"
              style={staggeredEntrance(2)}
            >
              <div className="w-12 h-12 rounded-xl bg-[rgba(46,196,182,0.12)] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Play size={24} className="text-[var(--success)]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {features[2].title}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                {features[2].description}
              </p>
            </div>

            {/* Feature 4 — spans 2 columns, horizontal layout with gradient accent */}
            <div
              className="md:col-span-2 rounded-2xl overflow-hidden border border-[var(--border-default)] group hover:border-[var(--primary-light)] hover:shadow-[var(--shadow-md)] transition-all duration-300 flex flex-col md:flex-row"
              style={staggeredEntrance(3)}
            >
              <div className="md:w-1/3 gradient-cool p-6 flex items-center justify-center">
                <RotateCcw size={40} className="text-white opacity-90" />
              </div>
              <div className="md:w-2/3 bg-[var(--bg-card)] p-6 flex flex-col justify-center">
                <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  {features[3].title}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {features[3].description}
                </p>
              </div>
            </div>

            {/* Feature 5 — standard */}
            <div
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-6 flex flex-col group hover:border-[var(--primary-light)] hover:shadow-[var(--shadow-md)] transition-all duration-300"
              style={staggeredEntrance(4)}
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--primary-muted)] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <BookOpen size={24} className="text-[var(--primary)]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {features[4].title}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                {features[4].description}
              </p>
            </div>

            {/* Feature 6 — standard */}
            <div
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-6 flex flex-col group hover:border-[var(--primary-light)] hover:shadow-[var(--shadow-md)] transition-all duration-300"
              style={staggeredEntrance(5)}
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Mic size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {features[5].title}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                {features[5].description}
              </p>
            </div>

            {/* Decorative accent cell */}
            <div
              className="rounded-2xl gradient-brand p-6 flex flex-col items-center justify-center text-center group hover:shadow-[var(--shadow-glow-primary)] transition-all duration-300"
              style={staggeredEntrance(6)}
            >
              <p className="text-white/90 font-display text-lg font-bold">Ready to start?</p>
              <p className="text-white/60 text-sm mt-1">Join 2,000+ students</p>
              <Link
                to="/register"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-white text-[var(--primary)] text-sm font-semibold px-5 py-2 hover:bg-white/90 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <section className="bg-[var(--bg-raised)] py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <StatItem key={s.label} {...s} />
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="gradient-cool py-24 px-6">
        <div className="max-w-2xl mx-auto text-center" style={fadeInUp()}>
          <h2 className="font-display text-3xl font-bold text-white">Ready to level up?</h2>
          <p className="mt-4 text-white/70">
            Join thousands of students who are acing their coding interviews with collaborative
            practice.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center mt-8 gradient-brand text-white font-semibold rounded-xl px-8 py-3 hover:shadow-[var(--shadow-glow-primary)] transition-all duration-200"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="relative bg-[var(--secondary)] text-white py-16 px-6 overflow-hidden">
        {/* Geo overlay */}
        <div className="absolute inset-0 geo-grid opacity-5" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Brand */}
            <div>
              <span className="font-display text-xl font-bold gradient-text">SynCode</span>
              <p className="mt-3 text-sm text-white/60">
                Collaborative coding interview practice for CS students.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
                Product
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/problems"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Problems
                  </Link>
                </li>
                <li>
                  <Link
                    to="/rooms/join"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Rooms
                  </Link>
                </li>
                <li>
                  <Link
                    to="/dashboard"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
                Account
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/login"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link
                    to="/register"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Register
                  </Link>
                </li>
                <li>
                  <Link
                    to="/profile"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Profile
                  </Link>
                </li>
              </ul>
            </div>

            {/* Dev */}
            <div>
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
                Dev
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/dev"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Component Gallery
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin"
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Admin Panel
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
            <span>&copy; {new Date().getFullYear()} SynCode. All rights reserved.</span>
            <span>Design Reference B — Bold &amp; Energetic</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
