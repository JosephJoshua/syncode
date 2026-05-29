import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { type MouseEvent, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatedNumber } from './animated-number';

const STATS = [
  { value: 50000, suffix: '+', labelKey: 'stats.sessions', accent: 'oklch(0.82 0.18 165)' },
  { value: 50, prefix: '<', suffix: 'ms', labelKey: 'stats.sync', accent: 'oklch(0.72 0.19 35)' },
  { value: 12, labelKey: 'stats.languages', accent: 'oklch(0.7 0.15 320)' },
  {
    value: 2,
    prefix: '<',
    suffix: 's',
    labelKey: 'stats.execution',
    accent: 'oklch(0.92 0.22 130)',
  },
] as const;

/* ── Floating particle data ──────────────────────────────────── */
const PARTICLES = [
  { x: '15%', y: '20%', size: 3, dur: 7, delay: 0, color: 'oklch(0.82 0.18 165 / 0.3)' },
  { x: '75%', y: '30%', size: 2, dur: 9, delay: 1.2, color: 'oklch(0.72 0.19 35 / 0.25)' },
  { x: '40%', y: '65%', size: 4, dur: 8, delay: 2.5, color: 'oklch(0.7 0.15 320 / 0.25)' },
  { x: '85%', y: '70%', size: 2, dur: 6.5, delay: 0.8, color: 'oklch(0.92 0.22 130 / 0.3)' },
  { x: '55%', y: '15%', size: 3, dur: 10, delay: 3, color: 'oklch(0.82 0.18 165 / 0.2)' },
  { x: '10%', y: '80%', size: 2, dur: 7.5, delay: 1.8, color: 'oklch(0.72 0.19 35 / 0.25)' },
  { x: '65%', y: '50%', size: 1, dur: 8.5, delay: 4, color: 'oklch(0.92 0.22 130 / 0.3)' },
  { x: '30%', y: '40%', size: 2, dur: 6, delay: 0.5, color: 'oklch(0.7 0.15 320 / 0.2)' },
];

export function StatsSection() {
  const { t } = useTranslation('landing');
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-120px' });
  const prefersReducedMotion = useReducedMotion();

  /* ── Mouse-driven parallax ────────────────────────────────── */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springCfg = { stiffness: 80, damping: 25 };
  const smoothX = useSpring(mouseX, springCfg);
  const smoothY = useSpring(mouseY, springCfg);

  const bigNumX = useTransform(smoothX, [-0.5, 0.5], [15, -15]);
  const bigNumY = useTransform(smoothY, [-0.5, 0.5], [8, -8]);
  const smallNumX = useTransform(smoothX, [-0.5, 0.5], [-10, 10]);
  const smallNumY = useTransform(smoothY, [-0.5, 0.5], [-5, 5]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!sectionRef.current || prefersReducedMotion) return;
      const rect = sectionRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mouseX, mouseY, prefersReducedMotion],
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse parallax needs tracking
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden bg-charcoal py-24 sm:py-32"
    >
      {/* Floating background particles */}
      {!prefersReducedMotion && (
        <>
          {PARTICLES.map((p) => (
            <motion.div
              key={`${p.x}-${p.y}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
              animate={{
                y: [0, -30 - p.size * 5, 0],
                x: [0, (p.size % 2 === 0 ? 1 : -1) * (10 + p.size * 3), 0],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: p.dur,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
                delay: p.delay,
              }}
            />
          ))}
        </>
      )}

      {/* Background noise texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, oklch(1 0 0) 0.5px, transparent 0.5px)',
          backgroundSize: '8px 8px',
        }}
      />

      <div className="mx-auto max-w-7xl px-6">
        {/* ── Desktop: asymmetric editorial layout ── */}
        <div className="hidden items-start gap-16 lg:grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_440px] xl:gap-24">
          {/* Dominant stat — left (moves with mouse parallax) */}
          <motion.div
            style={prefersReducedMotion ? undefined : { x: bigNumX, y: bigNumY }}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-baseline gap-3">
              <span
                className="font-display font-bold leading-none tracking-tight text-white"
                style={{ fontSize: 'clamp(6rem, 18vw, 15rem)' }}
              >
                {inView ? <AnimatedNumber to={STATS[0].value} duration={2.5} /> : '0'}
                {STATS[0].suffix}
              </span>
            </div>
            {/* Glowing accent underline */}
            <div className="mt-4 h-px w-48 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: STATS[0].accent }}
                initial={{ scaleX: 0 }}
                animate={inView ? { scaleX: 1 } : {}}
                transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="mt-4 font-mono text-sm uppercase tracking-[0.2em] text-white/25">
              {t(STATS[0].labelKey)}
            </p>
          </motion.div>

          {/* Three secondary stats — right (opposite mouse parallax) */}
          <motion.div
            className="space-y-12 pt-4"
            style={prefersReducedMotion ? undefined : { x: smallNumX, y: smallNumY }}
          >
            {STATS.slice(1).map((stat, i) => (
              <motion.div
                key={t(stat.labelKey)}
                className="flex items-baseline gap-4"
                initial={{ opacity: 0, x: 30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Animated accent bar — pulses gently */}
                <div className="relative mt-1">
                  <motion.span
                    className="block h-3 w-1 rounded-full"
                    style={{ backgroundColor: stat.accent }}
                    animate={
                      prefersReducedMotion ? {} : { scaleY: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }
                    }
                    transition={{
                      duration: 3 + i * 0.7,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeInOut',
                      delay: i * 0.5,
                    }}
                  />
                </div>
                <div>
                  <span
                    className="font-display font-bold leading-none tracking-tight text-white"
                    style={{ fontSize: 'clamp(3rem, 8vw, 5rem)' }}
                  >
                    {'prefix' in stat ? stat.prefix : ''}
                    {inView ? <AnimatedNumber to={stat.value} duration={2} /> : '0'}
                    {'suffix' in stat ? stat.suffix : ''}
                  </span>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-white/25">
                    {t(stat.labelKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* ── Mobile: stacked ── */}
        <div className="space-y-14 lg:hidden">
          {STATS.map((stat, i) => (
            <motion.div
              key={t(stat.labelKey)}
              className="flex items-baseline gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.span
                className="mt-1 block h-3 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: stat.accent }}
                animate={
                  prefersReducedMotion ? {} : { scaleY: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }
                }
                transition={{
                  duration: 3 + i * 0.7,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                  delay: i * 0.5,
                }}
              />
              <div>
                <span
                  className="font-display font-bold leading-none tracking-tight text-white"
                  style={{
                    fontSize: i === 0 ? 'clamp(3rem, 15vw, 6rem)' : 'clamp(2.5rem, 10vw, 4rem)',
                  }}
                >
                  {'prefix' in stat ? stat.prefix : ''}
                  <AnimatedNumber to={stat.value} duration={2} />
                  {'suffix' in stat ? stat.suffix : ''}
                </span>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-white/25">
                  {t(stat.labelKey)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
