import { Button } from '@syncode/ui';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, Braces, ChevronDown, MessageSquare, Terminal, Users, Zap } from 'lucide-react';
import { animate, motion, useInView, useMotionValue } from 'motion/react';
import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { GlowOrb, PageBackground } from '@/components/background';
import { CursorSpotlight } from '@/components/spotlight';
import { TerminalDemo } from '@/components/terminal-demo';

export const Route = createFileRoute('/')({
  component: HomePage,
});

// Floating code symbols
const CODE_SYMBOLS = [
  '</',
  '/>',
  '{;}',
  '( )',
  '[ ]',
  '&&',
  '=>',
  '::',
  '/**/',
  '!=',
  '++',
  '0x',
  '>>>',
  '${',
  '??',
  '|>',
];

const FloatingSymbols = memo(function FloatingSymbols() {
  const symbols = useMemo(
    () =>
      CODE_SYMBOLS.map((symbol, i) => ({
        symbol,
        left: `${5 + ((i * 5.7) % 90)}%`,
        delay: i * 0.9,
        duration: 14 + (i % 6) * 2.5,
        size: 11 + (i % 4) * 2,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {symbols.map((s) => (
        <span
          key={s.symbol}
          className="absolute font-mono text-primary/[0.08] select-none"
          style={{
            left: s.left,
            fontSize: `${s.size}px`,
            animation: `float-drift ${s.duration}s ${s.delay}s linear infinite`,
          }}
        >
          {s.symbol}
        </span>
      ))}
    </div>
  );
});

// Language marquee
const LANGUAGES = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Go',
  'Rust',
  'Java',
  'C++',
  'Ruby',
  'C#',
  'Kotlin',
];

function LanguageMarquee() {
  return (
    <div className="relative overflow-hidden border-y border-border/20 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

      <div className="flex w-max animate-[marquee_30s_linear_infinite]">
        {[0, 1].map((copy) =>
          LANGUAGES.map((lang) => (
            <span
              key={`${copy}-${lang}`}
              className="mx-8 inline-flex items-center gap-2 font-mono text-sm text-muted-foreground/40"
            >
              <span className="size-1.5 rounded-full bg-primary/30" />
              {lang}
            </span>
          )),
        )}
      </div>
    </div>
  );
}

function AnimatedNumber({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const val = useMotionValue(0);

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(val, to, { duration: 2, ease: 'easeOut' });
    return () => controls.stop();
  }, [isInView, val, to]);

  useEffect(() => {
    return val.on('change', (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v));
    });
  }, [val]);

  return <span ref={ref}>0</span>;
}

function GradientDivider() {
  return (
    <div className="mx-auto h-px max-w-xs bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
  );
}

const stagger = (i: number) => ({ delay: 0.05 + i * 0.1 });

function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden">
        <PageBackground />
        <FloatingSymbols />
        <CursorSpotlight />

        {/* Drifting glow orbs */}
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -25, 10, 0] }}
          transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2"
        >
          <GlowOrb className="animate-[glowPulse_4s_ease-in-out_infinite]" size="lg" />
        </motion.div>
        <motion.div
          animate={{ x: [0, -20, 15, 0], y: [0, 15, -10, 0] }}
          transition={{ duration: 25, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-1/4 top-2/3"
        >
          <GlowOrb className="animate-[glowPulse_5s_ease-in-out_infinite_1.5s]" size="sm" />
        </motion.div>
        <motion.div
          animate={{ x: [0, 25, -15, 0], y: [0, -15, 20, 0] }}
          transition={{ duration: 22, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="pointer-events-none absolute right-1/4 top-1/3"
        >
          <GlowOrb className="animate-[glowPulse_6s_ease-in-out_infinite_3s]" size="sm" />
        </motion.div>

        {/* Decorative code brackets */}
        <motion.span
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 0.04, x: 0 }}
          transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
          className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 font-mono text-[clamp(120px,20vw,280px)] leading-none text-primary select-none lg:block"
        >
          {'{\u200B'}
        </motion.span>
        <motion.span
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 0.04, x: 0 }}
          transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
          className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 font-mono text-[clamp(120px,20vw,280px)] leading-none text-primary select-none lg:block"
        >
          {'\u200B}'}
        </motion.span>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          {/* Terminal badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5"
          >
            <Terminal className="size-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">$ syncode --init</span>
            <span className="h-3.5 w-px bg-primary/30" />
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ...stagger(1), ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl font-bold tracking-tighter text-foreground sm:text-6xl lg:text-7xl"
          >
            Code interviews,
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-primary via-primary/60 to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-x_4s_ease-in-out_infinite]">
              reimagined.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ...stagger(2), ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Real-time pair programming. Sandboxed execution. AI&#8209;powered feedback.
            <br className="hidden sm:block" />
            Practice like it&#8217;s the real thing.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ...stagger(3), ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button asChild size="lg" className="shimmer-sweep">
              <Link to="/register">
                Get started
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          </motion.div>

          {/* Online now badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 2 }}
            className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-muted-foreground/50"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500/50" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            247 engineers online now
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 8, 0] }}
            transition={{
              opacity: { duration: 0.5, delay: 1.5 },
              y: { duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' },
            }}
            className="mt-14"
          >
            <ChevronDown className="mx-auto size-5 text-muted-foreground/40" />
          </motion.div>
        </div>
      </section>

      {/* Language Marquee */}
      <LanguageMarquee />

      {/* Features */}
      <section className="relative py-32">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 text-center"
          >
            <span className="font-mono text-xs text-primary/60">{"// what's inside"}</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built for <span className="text-primary">engineers</span>, by engineers.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Everything you need to simulate a real technical interview.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-3">
            <FeatureCard
              icon={<Users className="size-5" />}
              title="Pair Programming"
              description="Edit the same file at the same time. Both cursors work — no conflicts, no lag."
              decorator="collab.connect({ crdt: true })"
              index={0}
              accent={
                <div className="flex gap-1">
                  <motion.span
                    className="size-2 rounded-full bg-amber-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <motion.span
                    className="size-2 rounded-full bg-violet-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: 0.6 }}
                  />
                </div>
              }
            />
            <FeatureCard
              icon={<Braces className="size-5" />}
              title="Live Execution"
              description="Hit run. See your code execute against real test cases in seconds — not a simulation."
              decorator={'sandbox.exec("python", code)'}
              index={1}
              accent={
                <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-green-400/80"
                    animate={{ width: ['0%', '100%'] }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      repeatDelay: 1,
                      ease: 'easeInOut',
                    }}
                  />
                </div>
              }
            />
            <FeatureCard
              icon={<MessageSquare className="size-5" />}
              title="AI Feedback"
              description="Get told where your solution is slow, what edge cases you missed, and how to fix it."
              decorator={'ai.review({ depth: "senior" })'}
              index={2}
              accent={
                <div className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="size-1.5 rounded-full bg-primary/60"
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        duration: 0.8,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: d * 0.15,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </section>

      <GradientDivider />

      {/* Stats */}
      <section className="relative py-24">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="font-mono text-4xl font-bold text-foreground sm:text-5xl">
                <AnimatedNumber to={10} />
                <span className="text-primary">+</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Languages supported</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-center"
            >
              <div className="font-mono text-4xl font-bold text-foreground sm:text-5xl">
                <AnimatedNumber to={2} />
                <span className="text-primary">x</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Faster than solo prep</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
              <div className="font-mono text-4xl font-bold text-foreground sm:text-5xl">
                <AnimatedNumber to={0} />
                <span className="text-primary"> lag</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Real-time editing</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-center"
            >
              <div className="font-mono text-4xl font-bold text-foreground sm:text-5xl">
                <AnimatedNumber to={24} />
                <span className="text-primary">/7</span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">AI feedback available</div>
            </motion.div>
          </div>
        </div>
      </section>

      <GradientDivider />

      {/* How It Works */}
      <section className="relative py-32">
        <div className="mx-auto max-w-4xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 text-center"
          >
            <span className="font-mono text-xs text-primary/60">{'// how it works'}</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Interview prep in <span className="text-primary">three steps</span>.
            </h2>
          </motion.div>

          <div className="relative grid gap-12 sm:grid-cols-3 sm:gap-8">
            {/* Connecting dashed line(desktop) */}
            <div className="pointer-events-none absolute top-6 right-20 left-20 hidden h-px border-t border-dashed border-primary/15 sm:block" />

            <StepCard
              num={1}
              icon={<Terminal className="size-4" />}
              title="Spawn a room"
              description="One click creates an isolated session with a shared editor and voice channel."
              index={0}
            />
            <StepCard
              num={2}
              icon={<Users className="size-4" />}
              title="Code in sync"
              description="Write code side-by-side. You both see every keystroke instantly — no copy-paste, no screen sharing."
              index={1}
            />
            <StepCard
              num={3}
              icon={<Zap className="size-4" />}
              title="Run & review"
              description="Execute tests, get AI analysis, and replay sessions to improve."
              index={2}
            />
          </div>
        </div>
      </section>

      <GradientDivider />

      {/* Terminal Demo */}
      <section className="relative py-20">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 text-center"
          >
            <span className="font-mono text-xs text-primary/60">{'// see it in action'}</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Watch it come <span className="text-primary">together</span>.
            </h2>
            <p className="mt-3 text-muted-foreground">
              A complete interview session — from problem to passing tests — in seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-4xl"
          >
            <TerminalDemo />
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-32">
        <PageBackground />

        <motion.div
          animate={{ x: [0, 20, -10, 0], y: [0, -15, 10, 0] }}
          transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <GlowOrb className="animate-[glowPulse_4s_ease-in-out_infinite]" size="lg" />
        </motion.div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="font-mono text-xs text-primary/60">{'// ready?'}</span>
            <h2 className="mt-4 text-4xl font-bold tracking-tighter text-foreground sm:text-5xl">
              Stop grinding <span className="text-muted-foreground/30 line-through">alone</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/60 to-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-[gradient-x_4s_ease-in-out_infinite]">
                Start syncing.
              </span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Join your peers and practice interviews the way they actually happen — together.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="shimmer-sweep">
                <Link to="/register">
                  Get started for free
                  <ArrowRight data-icon="inline-end" className="size-4" />
                </Link>
              </Button>
              <span className="font-mono text-xs text-muted-foreground/40">
                No credit card required
              </span>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  decorator,
  index,
  accent,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  decorator: string;
  index: number;
  accent: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_0_30px_-10px_oklch(0.82_0.18_165/0.15)]"
    >
      {/* Live accent indicator */}
      <div className="absolute right-4 top-4">{accent}</div>

      <div className="mb-4 inline-flex self-start rounded-lg border border-border bg-muted/50 p-2.5 text-primary transition-all duration-300 group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:shadow-[0_0_12px_-3px_oklch(0.82_0.18_165/0.3)]">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-auto pt-4 font-mono text-[11px] text-primary/30 transition-colors group-hover:text-primary/60">
        {decorator}
      </div>
    </motion.div>
  );
}

function StepCard({
  num,
  icon,
  title,
  description,
  index,
}: {
  num: number;
  icon: ReactNode;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="text-center"
    >
      <motion.div
        whileInView={{ scale: [0.8, 1.1, 1] }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
        className="relative z-10 mx-auto mb-5 flex size-12 items-center justify-center rounded-full border border-primary/30 bg-background"
      >
        <span className="flex items-center gap-1 text-primary">
          {icon}
          <span className="font-mono text-sm font-bold">{num}</span>
        </span>
      </motion.div>

      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </motion.div>
  );
}
