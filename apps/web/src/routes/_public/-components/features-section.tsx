import { AlertTriangle, Check, CheckCircle2, Mic, Sparkles, Zap } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/* ── Feature definitions ─────────────────────────────────────── */
const FEATURES = [
  {
    id: 'pair',
    titleKey: 'features.pairProgramming',
    descKey: 'features.pairProgrammingDesc',
    accentColor: 'oklch(0.82 0.18 165)',
  },
  {
    id: 'exec',
    titleKey: 'features.liveExecution',
    descKey: 'features.liveExecutionDesc',
    accentColor: 'oklch(0.72 0.19 35)',
  },
  {
    id: 'feedback',
    titleKey: 'features.aiFeedback',
    descKey: 'features.aiFeedbackDesc',
    accentColor: 'oklch(0.7 0.15 320)',
  },
  {
    id: 'interview',
    titleKey: 'features.aiInterviewer',
    descKey: 'features.aiInterviewerDesc',
    accentColor: 'oklch(0.92 0.22 130)',
  },
] as const;

/* ── Waveform bar data (deterministic) ───────────────────────── */
const WAVEFORM = Array.from({ length: 32 }, (_, i) => ({
  h: 12 + Math.abs(Math.sin(i * 0.6)) * 50 + Math.abs(Math.cos(i * 1.1)) * 20,
  dur: 0.5 + (i % 5) * 0.12,
  del: i * 0.025,
}));

const SPRING_POP = { type: 'spring' as const, stiffness: 500, damping: 18 };
const SPRING_SOFT = { type: 'spring' as const, stiffness: 200, damping: 22 };

/* ═══════════════════════════════════════════════════════════════
 * FeaturesSection — exported wrapper
 * ═══════════════════════════════════════════════════════════════ */
export function FeaturesSection() {
  return (
    <>
      <FeaturesDesktop />
      <FeaturesMobile />
    </>
  );
}

/* ── Desktop: scroll-driven sticky layout (lg+) ─────────────── */
function FeaturesDesktop() {
  const { t } = useTranslation('landing');
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const prevRef = useRef(0);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.max(0, Math.min(3, Math.floor(v * 4)));
    if (idx !== prevRef.current) {
      prevRef.current = idx;
      setActiveIndex(idx);
    }
  });

  /* Click a sidebar item → smooth-scroll to that feature */
  const scrollToFeature = useCallback((index: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + rect.top;
    const scrollable = rect.height - window.innerHeight;
    const target = sectionTop + ((index + 0.5) / FEATURES.length) * scrollable;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative hidden bg-ink lg:block"
      style={{ height: '400vh' }}
    >
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[280px_1fr] items-center gap-16 px-8 xl:grid-cols-[320px_1fr] xl:gap-24 xl:px-16">
          {/* ── Sidebar ── */}
          <div>
            <span className="mb-10 block font-mono text-[10px] uppercase tracking-[0.2em] text-primary/40">
              {t('features.sidebarLabel')}
            </span>
            <div className="space-y-1">
              {FEATURES.map((f, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => scrollToFeature(i)}
                    className="relative w-full cursor-pointer py-3 pl-6 text-left"
                  >
                    {active && (
                      <motion.div
                        layoutId="feat-bar"
                        className="absolute bottom-0 left-0 top-0 w-0.5 rounded-full"
                        style={{ backgroundColor: f.accentColor }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <p
                      className={`text-lg font-semibold transition-colors duration-500 ${
                        active
                          ? 'text-foreground'
                          : 'text-muted-foreground/25 hover:text-muted-foreground/50'
                      }`}
                    >
                      {t(f.titleKey)}
                    </p>
                    <AnimatePresence>
                      {active && (
                        <motion.p
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden text-sm leading-relaxed text-muted-foreground/50"
                        >
                          {t(f.descKey)}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>

            {/* Progress dots */}
            <div className="mt-12 flex gap-2">
              {FEATURES.map((f, i) => (
                <div key={f.id} className="h-1 w-8 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full bg-primary/50"
                    animate={{ scaleX: i <= activeIndex ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: '0%' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Product UI card ── */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-2xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 30, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -30, scale: 0.96 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <FeatureUI index={activeIndex} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Mobile: stacked cards (<lg) ─────────────────────────────── */
function FeaturesMobile() {
  const { t } = useTranslation('landing');
  return (
    <section className="bg-ink py-20 lg:hidden">
      <div className="mx-auto max-w-lg space-y-20 px-6">
        <span className="block text-center font-mono text-[10px] uppercase tracking-[0.2em] text-primary/40">
          {t('features.sidebarLabel')}
        </span>
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="h-4 w-0.5 rounded-full" style={{ backgroundColor: f.accentColor }} />
              <h3 className="text-lg font-semibold text-foreground">{t(f.titleKey)}</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground/50">{t(f.descKey)}</p>
            <FeatureUI index={i} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── Card switch ─────────────────────────────────────────────── */
function FeatureUI({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <PairProgrammingCard />;
    case 1:
      return <LiveExecutionCard />;
    case 2:
      return <AIFeedbackCard />;
    case 3:
      return <AIInterviewerCard />;
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
 * EDITORIAL POSTER CARDS
 * Bold gradient backgrounds. One dominant element per card.
 * High contrast. Large shapes. Committed color.
 * ═══════════════════════════════════════════════════════════════ */

/* ── 1. Pair Programming — two overlapping "editor" cards ────── */
function PairProgrammingCard() {
  return (
    <div
      className="relative overflow-hidden rounded-[2rem]"
      style={{
        height: 420,
        background: 'linear-gradient(145deg, oklch(0.68 0.16 175) 0%, oklch(0.16 0.04 190) 100%)',
      }}
    >
      {/* Decorative grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Alice's editor card — tilted left */}
      <motion.div
        className="absolute left-[6%] top-[10%] w-[55%] rounded-2xl border border-white/10 p-5"
        style={{
          background: 'oklch(0.12 0.02 200 / 0.85)',
          backdropFilter: 'blur(12px)',
          rotate: '-4deg',
        }}
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...SPRING_SOFT, delay: 0.05 }}
        whileHover={{ rotate: '-2deg', scale: 1.03, transition: SPRING_POP }}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-5 w-0.5 rounded-full bg-primary" />
          <span className="font-mono text-sm font-bold text-primary">alice</span>
          <span className="ml-auto font-mono text-[10px] text-white/20">ln 3</span>
        </div>
        <div className="space-y-2 font-mono text-[11px] leading-5 text-white/30">
          <div>
            <span className="text-white/50">def</span> two_sum(nums, target):
          </div>
          <div className="pl-4">seen = {'{}'}</div>
          <div className="rounded bg-primary/10 pl-4 text-white/40">
            <span className="text-white/50">for</span> i, num{' '}
            <span className="text-white/50">in</span> enumerate(nums):
            <motion.span
              className="ml-0.5 inline-block h-3 w-px bg-primary"
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                times: [0, 0.49, 0.5, 1],
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Bob's editor card — tilted right, overlapping */}
      <motion.div
        className="absolute bottom-[8%] right-[6%] w-[55%] rounded-2xl border border-white/10 p-5"
        style={{
          background: 'oklch(0.12 0.02 30 / 0.85)',
          backdropFilter: 'blur(12px)',
          rotate: '3deg',
        }}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...SPRING_SOFT, delay: 0.15 }}
        whileHover={{ rotate: '1deg', scale: 1.03, transition: SPRING_POP }}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-block h-5 w-0.5 rounded-full bg-coral" />
          <span className="font-mono text-sm font-bold text-coral">bob</span>
          <span className="ml-auto font-mono text-[10px] text-white/20">ln 7</span>
        </div>
        <div className="space-y-2 font-mono text-[11px] leading-5 text-white/30">
          <div className="pl-8">
            <span className="text-white/50">return</span> [seen[complement], i]
          </div>
          <div className="rounded bg-coral/10 pl-4 text-white/40">
            {'        '}seen[num] = i
            <motion.span
              className="ml-0.5 inline-block h-3 w-px bg-coral"
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                times: [0, 0.49, 0.5, 1],
                delay: 0.5,
              }}
            />
          </div>
          <div className="pl-4">
            <span className="text-white/50">return</span> []
          </div>
        </div>
      </motion.div>

      {/* Overlap center — pulsing sync orb */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...SPRING_POP, delay: 0.3 }}
      >
        {/* Outer pulse ring */}
        <motion.div
          className="absolute -inset-3 rounded-full border border-primary/30"
          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        {/* Inner pulse ring */}
        <motion.div
          className="absolute -inset-1.5 rounded-full border-2 border-primary/40"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
          transition={{
            duration: 2.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
            delay: 0.4,
          }}
        />
        {/* Core */}
        <div className="relative flex size-14 items-center justify-center rounded-full border border-white/15 bg-ink/95 shadow-lg backdrop-blur-md">
          {/* Animated arc */}
          <svg
            className="absolute inset-0 size-full -rotate-90"
            viewBox="0 0 56 56"
            aria-hidden="true"
          >
            <title>Sync</title>
            <motion.circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="oklch(0.82 0.18 165)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="50 100"
              animate={{ strokeDashoffset: [0, -300] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
            />
          </svg>
          <span className="relative font-mono text-[10px] font-bold text-primary">SYNC</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ── 2. Live Execution — giant 3/3 scoreboard ────────────────── */
function LiveExecutionCard() {
  const { t } = useTranslation('landing');
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] p-8"
      style={{
        height: 420,
        background: 'linear-gradient(145deg, oklch(0.62 0.17 38) 0%, oklch(0.16 0.04 30) 100%)',
      }}
    >
      {/* Massive number display */}
      <div className="relative flex h-full flex-col items-center justify-center pt-4">
        <motion.div
          className="flex items-baseline gap-1 font-display"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_POP}
        >
          <span className="text-[8rem] font-bold leading-none text-white sm:text-[10rem]">3</span>
          <span className="text-[4rem] font-bold leading-none text-white/30 sm:text-[5rem]">
            /3
          </span>
        </motion.div>

        {/* Three bouncing check circles */}
        <div className="mt-6 flex gap-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`check-${i.toString()}`}
              className="flex size-10 items-center justify-center rounded-full bg-white/15"
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ ...SPRING_POP, delay: 0.1 + i * 0.08 }}
              whileHover={{ scale: 1.2, transition: SPRING_POP }}
            >
              <Check className="size-5 text-white" />
            </motion.div>
          ))}
        </div>

        {/* Status label */}
        <motion.div
          className="mt-6 flex items-center gap-2.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <CheckCircle2 className="size-4 text-white/60" />
          <span className="font-mono text-sm font-medium uppercase tracking-wider text-white/60">
            {t('features.allTestsPassed')}
          </span>
        </motion.div>

        {/* Progress bar at bottom */}
        <motion.div
          className="mt-8 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="h-full rounded-full bg-white/50"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: '0%' }}
          />
        </motion.div>
      </div>

      {/* Corner glow */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, oklch(0.85 0.20 40), transparent 70%)' }}
      />
    </div>
  );
}

/* ── 3. AI Feedback — dominant score + colored insight bars ───── */
function AIFeedbackCard() {
  const { t } = useTranslation('landing');
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] p-10"
      style={{
        height: 420,
        background: 'linear-gradient(145deg, oklch(0.45 0.16 315) 0%, oklch(0.13 0.04 300) 100%)',
      }}
    >
      {/* Decorative concentric rings — background */}
      <div className="pointer-events-none absolute -inset-20 opacity-[0.04]">
        {[200, 300, 400, 500].map((r) => (
          <div
            key={r}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
            style={{ width: r, height: r }}
          />
        ))}
      </div>

      {/* Score display */}
      <div className="relative">
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={SPRING_SOFT}
        >
          <div className="flex items-baseline gap-1">
            <span className="font-display text-[7rem] font-bold leading-none text-white sm:text-[9rem]">
              8
            </span>
            <span className="font-display text-[3rem] font-bold leading-none text-white/25 sm:text-[4rem]">
              /10
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Sparkles className="size-4 text-white/50" />
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-white/35">
              {t('features.codeReviewScore')}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Abstract insight bars — colored horizontal bands at bottom */}
      <div className="absolute bottom-0 inset-x-0 flex flex-col">
        {/* Bar 1 — green (strength) */}
        <motion.div
          className="flex items-center gap-4 border-t border-white/[0.06] px-10 py-5"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING_SOFT, delay: 0.15 }}
        >
          <div className="flex h-8 w-2 shrink-0 rounded-full bg-white/60" />
          <div>
            <div className="h-1.5 w-28 rounded-full bg-white/25" />
            <div className="mt-1 h-1 w-20 rounded-full bg-white/10" />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Check className="size-3.5 text-white/40" />
            <span className="font-mono text-[10px] text-white/35">OK</span>
          </div>
        </motion.div>

        {/* Bar 2 — yellow (suggestion) */}
        <motion.div
          className="flex items-center gap-4 border-t border-white/[0.06] px-10 py-5"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING_SOFT, delay: 0.25 }}
        >
          <div className="flex h-8 w-2 shrink-0 rounded-full bg-white/40" />
          <div>
            <div className="h-1.5 w-24 rounded-full bg-white/25" />
            <div className="mt-1 h-1 w-14 rounded-full bg-white/10" />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Zap className="size-3.5 text-white/40" />
            <span className="font-mono text-[10px] text-white/35">OPT</span>
          </div>
        </motion.div>

        {/* Bar 3 — coral (warning) */}
        <motion.div
          className="flex items-center gap-4 border-t border-white/[0.06] px-10 py-5"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING_SOFT, delay: 0.35 }}
        >
          <div className="flex h-8 w-2 shrink-0 rounded-full bg-white/20" />
          <div>
            <div className="h-1.5 w-20 rounded-full bg-white/25" />
            <div className="mt-1 h-1 w-10 rounded-full bg-white/10" />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-white/40" />
            <span className="font-mono text-[10px] text-white/35">NOTE</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── 4. AI Interviewer — waveform + live chat ────────────────── */
function AIInterviewerCard() {
  const { t } = useTranslation('landing');
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] p-8"
      style={{
        height: 420,
        background: 'linear-gradient(145deg, oklch(0.75 0.18 140) 0%, oklch(0.16 0.05 135) 100%)',
      }}
    >
      {/* Header — white on green */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <motion.div
            className="size-2.5 rounded-full bg-white"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white/80">
            Live
          </span>
        </div>
        <span className="font-mono text-sm tabular-nums text-white/50">05:23</span>
      </div>

      {/* Central mic icon */}
      <div className="mt-4 flex justify-center">
        <motion.div
          className="relative"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={SPRING_POP}
        >
          <motion.div
            className="absolute -inset-4 rounded-full border-2 border-white/15"
            animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -inset-8 rounded-full border border-white/8"
            animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.2, 0.08] }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: 0.3,
            }}
          />
          <div className="flex size-14 items-center justify-center rounded-full bg-white/15">
            <Mic className="size-7 text-white/80" />
          </div>
        </motion.div>
      </div>

      {/* Waveform — fixed height container to prevent layout shift */}
      <div className="mt-4 flex items-end justify-center gap-[2px]" style={{ height: 72 }}>
        {WAVEFORM.map((bar, i) => (
          <motion.div
            key={`w-${i.toString()}`}
            className="w-[3px] rounded-full bg-white/25"
            animate={{ height: [6, bar.h, 6] }}
            transition={{
              duration: bar.dur,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: bar.del,
            }}
          />
        ))}
      </div>

      {/* Chat bubbles — white on green */}
      <div className="mt-4 space-y-2.5">
        <motion.div
          className="rounded-2xl rounded-tl-sm bg-white/12 px-4 py-3"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING_SOFT, delay: 0.2 }}
        >
          <span className="mb-1 block font-mono text-[10px] font-bold text-white/50">AI</span>
          <p className="text-sm leading-relaxed text-white/70">{t('features.aiQuestion')}</p>
        </motion.div>
        <motion.div
          className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-white/18 px-4 py-3"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING_SOFT, delay: 0.35 }}
        >
          <span className="mb-1 block text-right font-mono text-[10px] font-bold text-white/50">
            You
          </span>
          <p className="text-sm leading-relaxed text-white/70">
            {t('features.youAnswer')}
            <motion.span
              className="ml-0.5 inline-block h-3.5 w-px bg-white/60"
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                times: [0, 0.49, 0.5, 1],
              }}
            />
          </p>
        </motion.div>
      </div>
    </div>
  );
}
