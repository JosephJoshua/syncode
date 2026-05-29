import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { MascotCharacter } from './mascot-character';

/* ── Waypoints (% of section) ────────────────────────────────── */
const WAYPOINTS = [
  { x: 0.3, y: 0.5 },
  { x: 0.7, y: 0.2 },
  { x: 0.85, y: 0.6 },
  { x: 0.5, y: 0.8 },
  { x: 0.15, y: 0.35 },
  { x: 0.6, y: 0.15 },
  { x: 0.75, y: 0.75 },
  { x: 0.25, y: 0.65 },
  { x: 0.9, y: 0.4 },
  { x: 0.4, y: 0.15 },
  { x: 0.55, y: 0.55 },
  { x: 0.1, y: 0.7 },
];

const TRAIL_LEN = 14;
const GLOW: Record<string, string> = {
  cyan: 'oklch(0.82 0.18 165',
  coral: 'oklch(0.72 0.19 35',
};

/* ── Pick a random waypoint near the given one ───────────────── */
function randomWaypoint() {
  const idx = Math.floor(Math.random() * WAYPOINTS.length);
  const w = WAYPOINTS[idx]!;
  return {
    x: w.x + (Math.random() - 0.5) * 0.14,
    y: w.y + (Math.random() - 0.5) * 0.14,
  };
}

/* ── Hook: firefly spring motion ─────────────────────────────── */
function useFireflyMotion(paused: boolean) {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const springX = useSpring(x, { stiffness: 55, damping: 25, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 55, damping: 25, mass: 0.35 });
  const target = useRef({ x: 0.5, y: 0.5 });
  const jitterPhase = useRef(Math.random() * Math.PI * 2);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (paused) return;
    const to = randomWaypoint();
    target.current = to;
    x.set(to.x);
    y.set(to.y);

    const id = setInterval(
      () => {
        const to2 = randomWaypoint();
        target.current = to2;
        x.set(to2.x);
        y.set(to2.y);
      },
      2500 + Math.random() * 5000,
    );
    return () => clearInterval(id);
  }, [x, y, paused]);

  useAnimationFrame((_, delta) => {
    if (paused) return;
    jitterPhase.current += delta * 0.003;
    const jx =
      Math.sin(jitterPhase.current * 1.7) * 0.003 + Math.cos(jitterPhase.current * 3.1) * 0.0015;
    const jy =
      Math.cos(jitterPhase.current * 2.3) * 0.003 + Math.sin(jitterPhase.current * 2.7) * 0.0015;

    const sx = springX.get();
    const sy = springY.get();
    const dx = target.current.x - sx;
    const dy = target.current.y - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const js = Math.min(1, dist / 0.04);

    trailRef.current.push({ x: sx + jx * js, y: sy + jy * js });
    if (trailRef.current.length > TRAIL_LEN) trailRef.current.shift();
  });

  return { springX, springY, trailRef, target };
}

/* ── Compute mood & look direction from firefly state ─────────── */
function useMoodAndLook(firefly: ReturnType<typeof useFireflyMotion>, paused: boolean) {
  const [mood, setMood] = useState<'hover' | 'dart' | 'land'>('hover');
  const [lookAngle, setLookAngle] = useState(0);
  const landedAt = useRef(0);

  useAnimationFrame(() => {
    if (paused) return;
    const sx = firefly.springX.get();
    const sy = firefly.springY.get();
    const dx = firefly.target.current.x - sx;
    const dy = firefly.target.current.y - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const nextMood: 'hover' | 'dart' | 'land' =
      dist > 0.03 ? 'dart' : Date.now() - landedAt.current < 400 ? 'land' : 'hover';

    if (nextMood === 'land' && mood === 'dart') {
      landedAt.current = Date.now();
    }

    if (nextMood !== mood) setMood(nextMood);

    const raw =
      dist > 0.01
        ? Math.atan2(dy, dx) * (180 / Math.PI) - 90
        : lookAngle + (Math.sin(Date.now() * 0.001) * 8 - lookAngle) * 0.1;
    const clamped = Math.max(-30, Math.min(30, raw));
    setLookAngle(clamped);
  });

  return { mood, lookAngle };
}

/* ═══════════════════════════════════════════════════════════════
 * FlyingMascots
 * ═══════════════════════════════════════════════════════════════ */
export function FlyingMascots() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const cyan = useFireflyMotion(prefersReducedMotion);
  const coral = useFireflyMotion(prefersReducedMotion);
  const cyanMood = useMoodAndLook(cyan, prefersReducedMotion);
  const coralMood = useMoodAndLook(coral, prefersReducedMotion);

  // Re-render trail dots at ~20fps
  const [, setTick] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Connecting rope */}
      <RopeMotion a={cyan} b={coral} paused={prefersReducedMotion} />

      {/* Trails */}
      <FireflyTrail trailRef={cyan.trailRef} color="cyan" />
      <FireflyTrail trailRef={coral.trailRef} color="coral" />

      {/* Cyan character */}
      <motion.div
        className="absolute"
        style={{
          left: useTransform(cyan.springX, (v) => `${(v * 100).toFixed(1)}%`),
          top: useTransform(cyan.springY, (v) => `${(v * 100).toFixed(1)}%`),
          x: '-50%',
          y: '-50%',
        }}
      >
        <GlowPulse color="cyan" />
        <MascotCharacter
          color="cyan"
          size={70}
          mood={cyanMood.mood}
          lookAngle={cyanMood.lookAngle}
        />
      </motion.div>

      {/* Coral character */}
      <motion.div
        className="absolute"
        style={{
          left: useTransform(coral.springX, (v) => `${(v * 100).toFixed(1)}%`),
          top: useTransform(coral.springY, (v) => `${(v * 100).toFixed(1)}%`),
          x: '-50%',
          y: '-50%',
        }}
      >
        <GlowPulse color="coral" />
        <MascotCharacter
          color="coral"
          size={70}
          mood={coralMood.mood}
          lookAngle={coralMood.lookAngle}
        />
      </motion.div>
    </div>
  );
}

/* ── Glow pulse ──────────────────────────────────────────────── */
function GlowPulse({ color }: { color: 'cyan' | 'coral' }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: 50,
        height: 50,
        background: `radial-gradient(circle, ${GLOW[color]} / 0.2), transparent 70%)`,
        filter: 'blur(10px)',
      }}
      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() }}
    />
  );
}

/* ── Trail dots ──────────────────────────────────────────────── */
function FireflyTrail({
  trailRef,
  color,
}: {
  trailRef: { current: { x: number; y: number }[] };
  color: 'cyan' | 'coral';
}) {
  const dots = trailRef.current.map((p, i) => {
    const alpha = (i / TRAIL_LEN) * 0.35;
    const size = 1.5 + (i / TRAIL_LEN) * 3.5;
    return { x: p.x, y: p.y, alpha, size, i };
  });

  return (
    <>
      {dots.map((d) => (
        <div
          key={`t-${d.i}`}
          className="absolute rounded-full"
          style={{
            left: `${(d.x * 100).toFixed(1)}%`,
            top: `${(d.y * 100).toFixed(1)}%`,
            width: d.size,
            height: d.size,
            transform: 'translate(-50%, -50%)',
            background: `${GLOW[color]} / ${d.alpha})`,
            boxShadow: `0 0 ${d.size * 3}px ${GLOW[color]} / ${d.alpha * 0.4})`,
          }}
        />
      ))}
    </>
  );
}

/* ── Rope with physics ───────────────────────────────────────────
 * The rope doesn't instantly snap to the characters — it has
 * inertia (lag), dynamic sag (slack when close, taut when far),
 * and a subtle pendulum sway.
 * ─────────────────────────────────────────────────────────────── */
function RopeMotion({
  a,
  b,
  paused,
}: {
  a: ReturnType<typeof useFireflyMotion>;
  b: ReturnType<typeof useFireflyMotion>;
  paused: boolean;
}) {
  // Raw endpoints (follow characters instantly)
  const ax = useTransform(a.springX, (v) => v * 100);
  const ay = useTransform(a.springY, (v) => v * 100);
  const bx = useTransform(b.springX, (v) => v * 100);
  const by = useTransform(b.springY, (v) => v * 100);

  // Physical midpoint — has inertia, lags behind the characters
  const physMx = useMotionValue(50);
  const physMy = useMotionValue(50);
  const springMx = useSpring(physMx, { stiffness: 22, damping: 14, mass: 1.2 });
  const springMy = useSpring(physMy, { stiffness: 22, damping: 14, mass: 1.2 });

  // Physical sag — springs toward target sag (more slack when close)
  const physSag = useMotionValue(8);
  const springSag = useSpring(physSag, { stiffness: 35, damping: 16, mass: 0.5 });

  // Pendulum sway — side-to-side oscillation of the rope midpoint
  const sway = useMotionValue(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // Update physical values each frame
  useAnimationFrame((_, delta) => {
    if (paused) return;
    // Push midpoint toward raw center (with inertia from spring)
    const rm = (a.springX.get() + b.springX.get()) / 2;
    const rmy = (a.springY.get() + b.springY.get()) / 2;
    physMx.set(rm * 100);
    physMy.set(rmy * 100);

    // Dynamic sag: taut when far apart, slack when close
    const dx = (a.springX.get() - b.springX.get()) * 100;
    const dy = (a.springY.get() - b.springY.get()) * 100;
    const dist = Math.sqrt(dx * dx + dy * dy);
    physSag.set(Math.max(4, 20 - dist * 0.28));

    // Pendulum sway
    phaseRef.current += delta * 0.0012;
    sway.set(Math.sin(phaseRef.current) * 3.5 + Math.cos(phaseRef.current * 0.7) * 1.5);
  });

  // Control point: springed midpoint + physics sag + sway
  const cx = useTransform([springMx, sway], ([mx = 0, sw = 0]: number[]) => mx + sw);
  const cy = useTransform([springMy, springSag], ([my = 0, sg = 0]: number[]) => my + sg);

  const d = useTransform(
    [ax, ay, cx, cy, bx, by],
    ([av = 0, ayv = 0, cvx = 0, cvy = 0, bv = 0, byv = 0]: number[]) =>
      `M ${av} ${ayv} Q ${cvx} ${cvy} ${bv} ${byv}`,
  );

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <title>Connection</title>
      <motion.path
        d={d}
        stroke="oklch(0.82 0.18 165 / 0.2)"
        strokeWidth={0.4}
        strokeDasharray="1.5 1"
        fill="none"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        animate={{ strokeDashoffset: [0, -5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  );
}
