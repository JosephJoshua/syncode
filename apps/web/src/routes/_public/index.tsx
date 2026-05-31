import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import type { MouseEvent } from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TerminalDemo } from '@/components/terminal-demo.js';
import { CtaSection } from './-components/cta-section';
import { FeaturesSection } from './-components/features-section';
import { PairMascot } from './-components/pair-mascot';
import { StatsSection } from './-components/stats-section';

export const Route = createFileRoute('/_public/')({
  component: HomePage,
});

/* ═══ Splash Shatter ═══════════════════════════════════════════════════ */
const SHATTER_FRAGMENTS = [
  {
    clip: 'polygon(25% 25%, 58% 20%, 65% 58%, 30% 65%)',
    to: { x: '-70%', y: '-60%', rotate: -22, scale: 0.3, opacity: 0 },
    delay: 0.35,
    color: 'oklch(0.82 0.18 165)',
  },
  {
    clip: 'polygon(52% 20%, 80% 28%, 75% 62%, 58% 55%)',
    to: { x: '65%', y: '-50%', rotate: 26, scale: 0.25, opacity: 0 },
    delay: 0.4,
    color: 'oklch(0.78 0.17 165)',
  },
  {
    clip: 'polygon(-5% -5%, 55% -5%, 35% 30%, -5% 30%)',
    to: { x: '-100%', y: '-80%', rotate: -28, scale: 0.4, opacity: 0 },
    delay: 0.55,
    color: 'oklch(0.75 0.16 165)',
  },
  {
    clip: 'polygon(45% -5%, 105% -5%, 105% 35%, 78% 30%, 50% 22%)',
    to: { x: '100%', y: '-75%', rotate: 32, scale: 0.35, opacity: 0 },
    delay: 0.6,
    color: 'oklch(0.70 0.15 165)',
  },
  {
    clip: 'polygon(-5% 25%, 32% 28%, 35% 62%, -5% 72%)',
    to: { x: '-110%', y: '20%', rotate: -18, scale: 0.4, opacity: 0 },
    delay: 0.5,
    color: 'oklch(0.72 0.16 165)',
  },
  {
    clip: 'polygon(72% 30%, 105% 28%, 105% 68%, 68% 60%)',
    to: { x: '105%', y: '15%', rotate: 24, scale: 0.4, opacity: 0 },
    delay: 0.55,
    color: 'oklch(0.68 0.14 165)',
  },
  {
    clip: 'polygon(-5% 65%, 38% 58%, 48% 105%, -5% 105%)',
    to: { x: '-85%', y: '90%', rotate: -24, scale: 0.4, opacity: 0 },
    delay: 0.65,
    color: 'oklch(0.65 0.15 165)',
  },
  {
    clip: 'polygon(32% 60%, 65% 55%, 72% 62%, 105% 65%, 105% 105%, 42% 105%)',
    to: { x: '80%', y: '85%', rotate: 22, scale: 0.3, opacity: 0 },
    delay: 0.7,
    color: 'oklch(0.60 0.14 165)',
  },
] as const;

function HomePage() {
  const { t } = useTranslation('landing');
  const prefersReducedMotion = useReducedMotion();

  /* ── Terminal 3D scene: mouse-driven tilt ─────────────────────── */
  const termRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  // Scroll-driven entrance
  const { scrollYProgress: tp } = useScroll({
    target: termRef,
    offset: ['start end', 'start 0.25'],
  });
  const termEntryScale = useTransform(tp, [0, 1], [0.85, 1]);
  const termEntryOpacity = useTransform(tp, [0, 0.3], [0, 1]);

  // Mouse-driven 3D tilt (interactive — moves with cursor over section)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { stiffness: 150, damping: 20 };
  const tiltX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), springConfig);
  const tiltY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), springConfig);

  // Satellite elements parallax (different z-depths)
  const satX = useSpring(useTransform(mouseX, [-0.5, 0.5], [15, -15]), springConfig);
  const satY = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const satNegX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), springConfig);
  const satFarX = useSpring(useTransform(mouseX, [-0.5, 0.5], [8, -8]), springConfig);
  const satFarY = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), springConfig);
  const satFarNegX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), springConfig);

  // Cursor glow — tracks mouse in PIXELS relative to the scene
  const glowPxX = useMotionValue(0);
  const glowPxY = useMotionValue(0);
  const glowSpringX = useSpring(glowPxX, { stiffness: 200, damping: 25 });
  const glowSpringY = useSpring(glowPxY, { stiffness: 200, damping: 25 });
  const glowVisible = useMotionValue(0);

  const handleSceneMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!sceneRef.current || prefersReducedMotion) return;
      const rect = sceneRef.current.getBoundingClientRect();
      // Normalized for tilt (-0.5 to 0.5)
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
      // Pixel coords for glow (relative to scene)
      glowPxX.set(e.clientX - rect.left);
      glowPxY.set(e.clientY - rect.top);
      glowVisible.set(1);
    },
    [mouseX, mouseY, glowPxX, glowPxY, glowVisible, prefersReducedMotion],
  );

  const handleSceneMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    glowVisible.set(0);
  }, [mouseX, mouseY, glowVisible]);

  return (
    <div className="relative">
      {/* ═══ SPLASH ═══════════════════════════════════════════════ */}
      {!prefersReducedMotion && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          {SHATTER_FRAGMENTS.map((frag) => (
            <motion.div
              key={frag.clip}
              className="absolute inset-0"
              style={{ clipPath: frag.clip, backgroundColor: frag.color }}
              initial={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
              animate={frag.to}
              transition={{ duration: 0.9, delay: frag.delay, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          >
            <span className="font-display text-6xl uppercase tracking-tight text-ink/70 sm:text-8xl">
              SynCode
            </span>
          </motion.div>
        </div>
      )}

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section className="relative flex h-svh flex-col items-center justify-center bg-ink">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(0.82 0.18 165) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 px-6 text-center">
          <h1
            className="font-display uppercase leading-[0.9] tracking-tight"
            style={{ fontSize: 'clamp(4.5rem, 14vw, 13rem)' }}
          >
            <span className="headline-reveal-line headline-reveal-line-1 block text-foreground">
              {t('hero.heading1')}
            </span>
            <span className="headline-reveal-line headline-reveal-line-2 block text-primary">
              {t('hero.heading2')}
            </span>
          </h1>

          <motion.div
            className="mt-8 sm:mt-12"
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              to="/register"
              className="inline-flex items-center rounded-full bg-foreground px-8 py-4 text-base font-medium text-background transition-shadow hover:shadow-lg-flat sm:text-lg"
            >
              <span className="btn-text-holder">
                <span className="btn-text-main flex items-center gap-2">
                  {t('button.getStarted')}
                  <ArrowRight className="size-5" />
                </span>
                <span className="btn-text-hover flex items-center gap-2" aria-hidden="true">
                  {t('button.getStartedHover')}
                  <ArrowRight className="size-5" />
                </span>
              </span>
            </Link>
          </motion.div>
        </div>

        {/* Mascot peeking from bottom */}
        <motion.div
          className="absolute bottom-0 left-1/2 z-20"
          style={{ x: '-50%', translateY: '40%' }}
          initial={prefersReducedMotion ? undefined : { scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 1.4, type: 'spring', stiffness: 60, damping: 12 }}
        >
          <PairMascot size={400} variant="idle" trackMouse />
        </motion.div>
      </section>

      {/* ═══ TERMINAL — Floating 3D scene ═════════════════════════
          The terminal floats in a 3D space. Mouse movement tilts the
          entire scene. Satellite UI elements (badges, indicators)
          float at different z-depths, creating parallax on tilt.
          A soft glow and reflection beneath add depth.
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="demo"
        ref={termRef}
        className="relative overflow-hidden bg-charcoal py-24 sm:py-32"
      >
        {/* Background grid — subtle spatial depth */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(oklch(0.82 0.18 165 / 0.3) 1px, transparent 1px), linear-gradient(90deg, oklch(0.82 0.18 165 / 0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Ambient floating particles */}
        {!prefersReducedMotion && (
          <>
            <motion.div
              className="pointer-events-none absolute left-[20%] top-[30%] size-1 rounded-full bg-primary/30"
              animate={{ y: [0, -30, 0], x: [0, 10, 0], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="pointer-events-none absolute right-[25%] top-[60%] size-1.5 rounded-full bg-coral/20"
              animate={{ y: [0, 20, 0], x: [0, -15, 0], opacity: [0.1, 0.4, 0.1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
            <motion.div
              className="pointer-events-none absolute left-[60%] top-[20%] size-1 rounded-full bg-primary/20"
              animate={{ y: [0, -20, 0], x: [0, -8, 0], opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
            <motion.div
              className="pointer-events-none absolute right-[40%] bottom-[20%] size-1 rounded-full bg-plum-soft/20"
              animate={{ y: [0, 15, 0], x: [0, 12, 0], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            />
          </>
        )}

        <div className="relative mx-auto max-w-6xl px-6">
          <motion.p
            className="mb-16 text-center font-display text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {t('terminal.heading1')} <span className="text-primary">{t('terminal.heading2')}</span>
          </motion.p>

          {/* 3D Scene container — mouse tilt zone */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: 3D scene needs mouse tracking for tilt effect */}
          <div
            ref={sceneRef}
            onMouseMove={handleSceneMouseMove}
            onMouseLeave={handleSceneMouseLeave}
            className="relative"
            style={{ perspective: '1200px' }}
          >
            {/* Cursor glow — a circle that follows the mouse exactly */}
            {!prefersReducedMotion && (
              <motion.div
                className="pointer-events-none absolute z-0 rounded-full"
                style={{
                  width: 500,
                  height: 500,
                  left: glowSpringX,
                  top: glowSpringY,
                  x: '-50%',
                  y: '-50%',
                  opacity: glowVisible,
                  background:
                    'radial-gradient(circle, oklch(0.82 0.18 165 / 0.12), oklch(0.82 0.18 165 / 0.03) 40%, transparent 70%)',
                }}
              />
            )}
            {/* Scroll entrance + mouse tilt combined */}
            <motion.div
              style={
                prefersReducedMotion
                  ? undefined
                  : {
                      rotateX: tiltX,
                      rotateY: tiltY,
                      scale: termEntryScale,
                      opacity: termEntryOpacity,
                      transformOrigin: 'center center',
                    }
              }
            >
              {/* Terminal card with mouse-tracked glow */}
              <div className="relative">
                {/* Glow that follows cursor — like a spotlight */}
                <motion.div
                  className="pointer-events-none absolute -inset-12 -z-10 rounded-3xl opacity-40 blur-3xl"
                  style={{
                    background: useTransform(
                      [mouseX, mouseY],
                      ([mx, my]: number[]) =>
                        `radial-gradient(600px ellipse at ${50 + (mx as number) * 60}% ${50 + (my as number) * 60}%, oklch(0.82 0.18 165 / 0.35), transparent 70%)`,
                    ),
                  }}
                />
                {/* Secondary coral glow on opposite side */}
                <motion.div
                  className="pointer-events-none absolute -inset-12 -z-10 rounded-3xl opacity-20 blur-3xl"
                  style={{
                    background: useTransform(
                      [mouseX, mouseY],
                      ([mx, my]: number[]) =>
                        `radial-gradient(400px ellipse at ${50 - (mx as number) * 40}% ${50 - (my as number) * 40}%, oklch(0.72 0.19 35 / 0.3), transparent 70%)`,
                    ),
                  }}
                />

                <InViewTerminal />

                {/* Reflection — faint mirrored copy below */}
                <div
                  className="pointer-events-none mt-1 h-20 opacity-[0.07]"
                  style={{
                    background:
                      'linear-gradient(to bottom, oklch(0.82 0.18 165 / 0.2), transparent)',
                    maskImage: 'linear-gradient(to bottom, white, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, white, transparent)',
                  }}
                />
              </div>
            </motion.div>

            {/* ── Connecting lines from terminal to satellites ── */}
            {!prefersReducedMotion && (
              <svg
                className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full lg:block"
                fill="none"
              >
                <title>Connection lines</title>
                {/* Right side lines — pulsing dash animation */}
                <motion.line
                  x1="100%"
                  y1="15%"
                  x2="90%"
                  y2="30%"
                  stroke="oklch(0.82 0.18 165 / 0.15)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  animate={{ strokeDashoffset: [0, -16] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
                <motion.line
                  x1="100%"
                  y1="70%"
                  x2="92%"
                  y2="60%"
                  stroke="oklch(0.82 0.18 165 / 0.1)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  animate={{ strokeDashoffset: [0, -16] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 0.5 }}
                />
                {/* Left side lines */}
                <motion.line
                  x1="0%"
                  y1="35%"
                  x2="10%"
                  y2="40%"
                  stroke="oklch(0.82 0.18 165 / 0.12)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  animate={{ strokeDashoffset: [0, 16] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', delay: 0.3 }}
                />
                <motion.line
                  x1="0%"
                  y1="80%"
                  x2="8%"
                  y2="72%"
                  stroke="oklch(0.55 0.18 320 / 0.12)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  animate={{ strokeDashoffset: [0, 16] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', delay: 0.8 }}
                />
              </svg>
            )}

            {/* ── Floating satellite elements (different z-depths) ── */}
            {!prefersReducedMotion && (
              <>
                {/* LIVE badge — close to viewer (high parallax) */}
                <motion.div
                  className="absolute -right-4 top-8 z-20 hidden lg:block"
                  style={{ x: satX, y: satY }}
                  initial={{ opacity: 0, x: 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <div className="flex items-center gap-2 rounded-full bg-ink/80 px-4 py-2 backdrop-blur-sm">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400/60" />
                      <span className="relative inline-flex size-2 rounded-full bg-green-400" />
                    </span>
                    <span className="font-mono text-xs font-medium text-green-400">LIVE</span>
                  </div>
                </motion.div>

                {/* Connected users — close to viewer */}
                <motion.div
                  className="absolute -left-4 top-1/3 z-20 hidden lg:block"
                  style={{ x: satNegX, y: satY }}
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <div className="flex items-center gap-2 rounded-full bg-ink/80 px-4 py-2 backdrop-blur-sm">
                    <div className="flex -space-x-1.5">
                      <span className="size-4 rounded-full bg-primary ring-2 ring-ink" />
                      <span className="size-4 rounded-full bg-coral ring-2 ring-ink" />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">2 connected</span>
                  </div>
                </motion.div>

                {/* Test status — farther away (less parallax) */}
                <motion.div
                  className="absolute -right-2 bottom-1/4 z-20 hidden lg:block"
                  style={{ x: satFarX, y: satFarY }}
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <div className="flex items-center gap-2 rounded-xl bg-ink/80 px-4 py-2 backdrop-blur-sm">
                    <span className="text-green-400">✓</span>
                    <span className="font-mono text-xs text-muted-foreground">3/3 passed</span>
                  </div>
                </motion.div>

                {/* AI review badge — farther away */}
                <motion.div
                  className="absolute -left-2 bottom-12 z-20 hidden lg:block"
                  style={{ x: satFarNegX, y: satFarY }}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.0, type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <div className="flex items-center gap-2 rounded-xl bg-ink/80 px-4 py-2 backdrop-blur-sm">
                    <div className="flex size-5 items-center justify-center rounded-full bg-plum/20">
                      <span className="text-[10px] font-bold text-plum-soft">AI</span>
                    </div>
                    <span className="font-mono text-xs text-plum-soft">O(n) optimal</span>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </section>

      <FeaturesSection />

      <StatsSection />

      <CtaSection />
    </div>
  );
}

function InViewTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div ref={ref}>
      {isInView ? (
        <TerminalDemo />
      ) : (
        <div className="aurora-border terminal-glow overflow-hidden rounded-xl border border-primary/15 bg-[#0a0e14]">
          <div className="flex items-center border-b border-white/6 bg-white/2 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="mx-auto font-mono text-xs text-muted-foreground/50">
              two_sum.py — syncode
            </span>
          </div>
          <div className="h-[420px]" />
          <div className="border-t border-white/6 bg-white/2 px-4 py-2 font-mono text-[11px] text-muted-foreground/40">
            &nbsp;
          </div>
        </div>
      )}
    </div>
  );
}
