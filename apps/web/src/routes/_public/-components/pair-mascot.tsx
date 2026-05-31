import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * PairMascot — SynCode's living brand character.
 *
 * ALIVE behaviors:
 *   - Heads TURN toward cursor (skewY + translateX for 3D feel, not flat rotate)
 *   - Bodies lean toward cursor
 *   - Pupils track independently
 *   - Sync line bends toward cursor with spring physics
 *   - 3 data particles at staggered speeds
 *   - Auto-blink on random intervals
 *   - Idle breathing
 *   - DANCE: after ~10s idle (no mouse movement), characters do a celebration bounce
 *   - WIGGLE: rapid cursor movement triggers a quick head shake
 *   - Click triggers a jump + spin celebration
 */

type PoseVariant = 'idle' | 'blink' | 'wave' | 'peek' | 'run' | 'sit';

interface PairMascotProps {
  readonly variant?: PoseVariant;
  readonly size?: number;
  readonly accentSide?: 'left' | 'right';
  readonly className?: string;
  readonly trackMouse?: boolean;
}

// ── Pose variants ──────────────────────────────────────────────────
const spring = { type: 'spring' as const, stiffness: 260, damping: 18 };

const leftBodyVariants = {
  idle: { y: 0, rotate: 0, x: 0, transition: spring },
  blink: { y: 0, rotate: 0, x: 0, transition: spring },
  wave: {
    y: [0, -6, -2, -5, -1, -3, 0],
    rotate: [0, -4, -2, -5, -1, -3, 0],
    x: 0,
    transition: { duration: 1.4, ease: 'easeInOut' as const },
  },
  peek: { y: 8, rotate: 0, x: 0, transition: spring },
  run: { y: -3, rotate: -3, x: 0, transition: spring },
  // Sit: body tilts back, shifts down (legs dangle in front)
  sit: { y: 10, rotate: -6, x: 2, transition: spring },
};
const rightBodyVariants = {
  idle: { y: 0, rotate: 0, x: 0, transition: spring },
  blink: { y: 0, rotate: 0, x: 0, transition: spring },
  wave: {
    y: [0, -2, 0, -3, 0, -1, 0],
    rotate: [0, 3, 1, 4, 1, 2, 0],
    x: 0,
    transition: { duration: 1.4, ease: 'easeInOut' as const },
  },
  peek: { y: 8, rotate: 0, x: 0, transition: spring },
  run: { y: -3, rotate: 3, x: 0, transition: spring },
  sit: { y: 10, rotate: 6, x: -2, transition: spring },
};
// Left arm: waves with repeated back-and-forth keyframes (subtle, close to body)
const leftArmVariants = {
  idle: { rotate: 0, y: 0, transition: spring },
  blink: { rotate: 0, y: 0, transition: spring },
  wave: {
    rotate: [0, -20, -8, -22, -10, -15, 0],
    y: [0, -6, -3, -7, -4, -5, 0],
    transition: { duration: 1.4, ease: 'easeInOut' as const },
  },
  peek: { rotate: 3, y: 1, transition: spring },
  run: { rotate: -8, y: -2, transition: spring },
  sit: { rotate: 8, y: 4, transition: spring },
};
// Right arm: gentle matching motion
const rightArmVariants = {
  idle: { rotate: 0, y: 0, transition: spring },
  blink: { rotate: 0, y: 0, transition: spring },
  wave: {
    rotate: [0, 5, 2, 6, 3, 4, 0],
    y: [0, -2, -1, -2, -1, -1, 0],
    transition: { duration: 1.4, ease: 'easeInOut' as const },
  },
  peek: { rotate: -3, y: 1, transition: spring },
  run: { rotate: 8, y: -2, transition: spring },
  sit: { rotate: -8, y: 4, transition: spring },
};

// Run cycle keyframes — applied directly via animate prop (repeat works here)
const RUN_LEFT_ARM = { rotate: [-5, -15, -5, -15], y: [-1, -3, -1, -3] };
const RUN_LEFT_ARM_T = { duration: 0.5, repeat: Infinity, ease: 'easeInOut' as const };
const RUN_RIGHT_ARM = { rotate: [5, 15, 5, 15], y: [-1, -3, -1, -3] };
const RUN_RIGHT_ARM_T = { duration: 0.5, repeat: Infinity, ease: 'easeInOut' as const };

// Eye expressions: ry values for different emotions
const EYE_EXPRESSIONS = {
  idle: { ry: 4.5 }, // normal open
  blink: { ry: 0.4 }, // closed
  wave: { ry: 3.2 }, // happy squint (smaller = happier)
  peek: { ry: 5.5 }, // wide/surprised
  run: { ry: 3.8 }, // determined squint
  celebrate: { ry: 3.0 }, // very happy
  dance: { ry: 3.5 }, // playful
  sit: { ry: 3.8 }, // content, relaxed
} as const;

const EYE_RY_OPEN = 4.5;
const EYE_RY_BLINK = 0.4;
const BLINK_DURATION = 0.08;

// Mouse-driven spring (snappy with overshoot)
const mouseSpring = { stiffness: 150, damping: 12 };

export function PairMascot({
  variant = 'idle',
  size = 200,
  accentSide = 'left',
  className,
  trackMouse = false,
}: PairMascotProps) {
  const prefersReducedMotion = useReducedMotion();

  // ── Mouse tracking ────────────────────────────────────────────────
  const rawMouseX = useMotionValue(0.5);
  const rawMouseY = useMotionValue(0.5);
  const mouseX = useSpring(rawMouseX, mouseSpring);
  const mouseY = useSpring(rawMouseY, mouseSpring);

  // Head TURN (3D fake): skewY creates perspective distortion,
  // translateX shifts head in the look direction. No more flat rotate.
  const headSkewY = useTransform(mouseX, [0, 1], [-4, 4]);
  const headTranslateX = useTransform(mouseX, [0, 1], [-3, 3]);
  // Slight vertical nod when looking up/down
  const headTranslateY = useTransform(mouseY, [0, 1], [-2, 2]);

  // Pupil offset
  const pupilOffsetX = useTransform(mouseX, [0, 1], [-2.5, 2.5]);
  const pupilOffsetY = useTransform(mouseY, [0, 1], [-1.5, 1.5]);

  // Sync line control point follows cursor
  const syncControlY = useTransform(mouseY, [0, 1], [50, 70]);
  const syncControlX = useTransform(mouseX, [0, 1], [90, 110]);
  const syncPath = useTransform(
    [syncControlX, syncControlY],
    ([cx, cy]: number[]) => `M 65 75 C 80 ${cy}, ${cx} ${cy}, 135 75`,
  );

  // ── Rapid movement detection (wiggle trigger) ─────────────────────
  const lastMouseXRef = useRef(0.5);
  const directionChanges = useRef(0);
  const lastDirection = useRef(0);
  const [isWiggling, setIsWiggling] = useState(false);

  // ── Idle dance timer ──────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isDancing, setIsDancing] = useState(false);

  // ── Click celebration ─────────────────────────────────────────────
  const [isCelebrating, setIsCelebrating] = useState(false);

  // ── Auto-wave: waves ~3s after mount, then periodically every 8-15s ──
  const [isWaving, setIsWaving] = useState(false);
  useEffect(() => {
    if (variant !== 'idle' || prefersReducedMotion) return;
    // Initial wave after entrance settles
    const firstWave = setTimeout(() => {
      setIsWaving(true);
      setTimeout(() => setIsWaving(false), 1500);
    }, 3000);
    // Periodic waves
    const scheduleWave = () => {
      const delay = 8000 + Math.random() * 7000;
      return setTimeout(() => {
        if (!isDancing && !isCelebrating && !isWiggling) {
          setIsWaving(true);
          setTimeout(() => setIsWaving(false), 1500);
        }
        waveTimer = scheduleWave();
      }, delay);
    };
    let waveTimer = scheduleWave();
    return () => {
      clearTimeout(firstWave);
      clearTimeout(waveTimer);
    };
  }, [variant, prefersReducedMotion, isDancing, isCelebrating, isWiggling]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth;
      rawMouseX.set(nx);
      rawMouseY.set(e.clientY / window.innerHeight);

      // Detect rapid direction changes → wiggle
      const dir = nx > lastMouseXRef.current ? 1 : -1;
      if (dir !== lastDirection.current) {
        directionChanges.current++;
        lastDirection.current = dir;
        if (directionChanges.current > 3) {
          setIsWiggling(true);
          setTimeout(() => setIsWiggling(false), 500);
          directionChanges.current = 0;
        }
      }
      lastMouseXRef.current = nx;

      // Reset idle timer on any movement
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      setIsDancing(false);
      idleTimerRef.current = setTimeout(() => {
        setIsDancing(true);
        // Dance for 3 seconds then stop
        setTimeout(() => setIsDancing(false), 3000);
      }, 10000); // 10s of no movement → dance
    },
    [rawMouseX, rawMouseY],
  );

  // Slowly decay direction change counter
  useEffect(() => {
    const interval = setInterval(() => {
      if (directionChanges.current > 0) directionChanges.current--;
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!trackMouse || prefersReducedMotion) return;
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [trackMouse, prefersReducedMotion, handleMouseMove]);

  // Start the idle dance timer on mount too
  useEffect(() => {
    if (!trackMouse || prefersReducedMotion) return;
    idleTimerRef.current = setTimeout(() => {
      setIsDancing(true);
      setTimeout(() => setIsDancing(false), 3000);
    }, 10000);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [trackMouse, prefersReducedMotion]);

  const handleClick = useCallback(() => {
    if (prefersReducedMotion) return;
    setIsCelebrating(true);
    setTimeout(() => setIsCelebrating(false), 800);
  }, [prefersReducedMotion]);

  // Random celebration: every 15-30s, trigger a spontaneous celebration
  useEffect(() => {
    if (prefersReducedMotion) return;
    const scheduleRandomCelebration = () => {
      const delay = 15000 + Math.random() * 15000; // 15-30s
      return setTimeout(() => {
        if (!isDancing && !isWiggling) {
          setIsCelebrating(true);
          setTimeout(() => setIsCelebrating(false), 800);
        }
        randomCelebrationTimer = scheduleRandomCelebration();
      }, delay);
    };
    let randomCelebrationTimer = scheduleRandomCelebration();
    return () => clearTimeout(randomCelebrationTimer);
  }, [prefersReducedMotion, isDancing, isWiggling]);

  // ── Auto-blink ────────────────────────────────────────────────────
  const [isBlinking, setIsBlinking] = useState(false);
  useEffect(() => {
    if (variant !== 'idle' || prefersReducedMotion) return;
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 3000;
      return setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        timerId = scheduleBlink();
      }, delay);
    };
    let timerId = scheduleBlink();
    return () => clearTimeout(timerId);
  }, [variant, prefersReducedMotion]);

  // Priority: blink > wave > external variant
  const effectiveVariant = isBlinking ? 'blink' : isWaving ? 'wave' : variant;
  const isBlink = effectiveVariant === 'blink';

  const aspectRatio = 225 / 185;
  const width = size * aspectRatio;
  const flip = accentSide === 'right' ? -1 : 1;

  // Eye expression based on current state (emotions!)
  const eyeRy = isBlink
    ? EYE_RY_BLINK
    : isCelebrating
      ? EYE_EXPRESSIONS.celebrate.ry
      : isDancing
        ? EYE_EXPRESSIONS.dance.ry
        : isWaving
          ? EYE_EXPRESSIONS.wave.ry
          : (EYE_EXPRESSIONS[effectiveVariant as keyof typeof EYE_EXPRESSIONS]?.ry ?? EYE_RY_OPEN);
  const pupilOpacity = isBlink ? 0 : 1;

  // ── Per-character animations (NOT on the SVG root — each char moves independently) ──

  // Celebration: left char jumps first, right follows with delay. Arms flail.
  // The characters bounce off each other with staggered timing.
  const leftCelebrate = isCelebrating
    ? { y: [0, -14, 2, -8, 0], rotate: [0, -6, 4, -2, 0] }
    : undefined;
  const leftCelebrateT = isCelebrating
    ? { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }
    : undefined;
  const rightCelebrate = isCelebrating
    ? { y: [0, 2, -16, 0, -6, 0], rotate: [0, 3, 8, -3, 2, 0] }
    : undefined;
  const rightCelebrateT = isCelebrating
    ? { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const, delay: 0.1 }
    : undefined;

  // Dance: alternating bounce (no x-offset — characters stay in place)
  const leftDance = isDancing
    ? {
        y: [0, -10, 3, -10, 3, -6, 0],
        rotate: [0, -4, 2, 4, -2, -3, 0],
      }
    : undefined;
  const leftDanceT = isDancing ? { duration: 2, repeat: 1, ease: 'easeInOut' as const } : undefined;
  const rightDance = isDancing
    ? {
        y: [3, 0, -10, 3, -10, 0, 3],
        rotate: [0, 3, -2, -4, 2, 3, 0],
      }
    : undefined;
  const rightDanceT = isDancing
    ? { duration: 2, repeat: 1, ease: 'easeInOut' as const, delay: 0.15 }
    : undefined;

  // Wiggle: rapid head-only oscillation that decays (like shaking off water)
  // Applied to the HEAD groups, not the bodies — much more natural.
  const wiggleHead = isWiggling
    ? { rotate: [0, -10, 12, -8, 9, -5, 4, -2, 0], x: [0, -3, 4, -3, 2, -1, 1, 0, 0] }
    : undefined;
  const wiggleHeadT = isWiggling ? { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } : undefined;

  // Breathing (lowest priority)
  const isAnimating = isDancing || isCelebrating;
  const breatheAnimation =
    variant === 'idle' && !prefersReducedMotion && !isAnimating ? { y: [0, -6, 0] } : undefined;
  const breatheTransition =
    variant === 'idle' && !prefersReducedMotion && !isAnimating
      ? { duration: 4, repeat: Infinity, ease: 'easeInOut' as const }
      : undefined;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: decorative SVG, not interactive control
    <motion.svg
      viewBox="-20 -30 225 185"
      overflow="visible"
      width={width}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className ?? ''} ${trackMouse ? 'cursor-pointer' : ''}`}
      style={{ transform: flip === -1 ? 'scaleX(-1)' : undefined }}
      animate={breatheAnimation}
      transition={breatheTransition}
      onClick={trackMouse ? handleClick : undefined}
      role="img"
      aria-label="SynCode pair mascot"
    >
      {/* ── Sync line (bends toward cursor) ── */}
      <motion.path
        d={trackMouse ? syncPath : 'M 65 75 C 80 60, 120 60, 135 75'}
        stroke="var(--color-primary, oklch(0.82 0.18 165))"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />

      {/* Data particles at staggered speeds */}
      <motion.circle
        r={1.8}
        fill="var(--color-primary, oklch(0.82 0.18 165))"
        animate={{ cx: [68, 100, 132], cy: [73, 56, 73], opacity: [0, 0.6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: 0 }}
      />
      <motion.circle
        r={2.5}
        fill="var(--color-primary, oklch(0.82 0.18 165))"
        animate={{ cx: [68, 100, 132], cy: [73, 56, 73], opacity: [0, 1, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.7 }}
      />
      <motion.circle
        r={1.8}
        fill="var(--color-primary, oklch(0.82 0.18 165))"
        animate={{ cx: [68, 100, 132], cy: [73, 56, 73], opacity: [0, 0.6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay: 1.4 }}
      />

      {/* ── LEFT CHARACTER (Cyan) ── */}
      {/* Outer wrapper: celebration/dance animation (per-character timing) */}
      <motion.g
        animate={leftCelebrate ?? leftDance}
        transition={leftCelebrateT ?? leftDanceT}
        style={{ originX: '50px', originY: '90px' }}
      >
        <motion.g
          variants={leftBodyVariants}
          animate={effectiveVariant}
          initial="idle"
          style={{ originX: '50px', originY: '90px' }}
        >
          {/* Body */}
          <polygon
            points="35,55 65,55 70,105 30,105"
            fill="var(--color-primary, oklch(0.82 0.18 165))"
          />
          <polygon points="65,55 70,105 70,105 68,55" fill="oklch(0.65 0.16 165)" />

          {/* Head — 3D turn via skewY + translateX */}
          {/* Inner wiggle wrapper (rapid mouse → head-only shake) */}
          <motion.g
            animate={wiggleHead}
            transition={wiggleHeadT}
            style={{ originX: '50px', originY: '42px' }}
          >
            <motion.g
              style={{
                originX: '50px',
                originY: '42px',
                skewY: trackMouse ? headSkewY : 0,
                x: trackMouse ? headTranslateX : 0,
                y: trackMouse ? headTranslateY : 0,
              }}
            >
              <polygon
                points="38,28 62,28 67,55 50,58 33,55"
                fill="var(--color-primary, oklch(0.82 0.18 165))"
              />
              <polygon points="38,28 62,28 60,38 40,38" fill="oklch(0.88 0.15 165)" opacity={0.5} />

              {/* Eyes */}
              <motion.ellipse
                cx={44}
                cy={42}
                rx={3.5}
                animate={{ ry: eyeRy }}
                transition={{ duration: BLINK_DURATION }}
                fill="white"
              />
              <motion.circle
                r={2}
                fill="oklch(0.15 0.01 260)"
                animate={{ opacity: pupilOpacity }}
                transition={{ duration: BLINK_DURATION }}
                style={{
                  cx: trackMouse ? pupilOffsetX : 44,
                  cy: trackMouse ? pupilOffsetY : 42,
                  x: trackMouse ? 44 : 0,
                  y: trackMouse ? 42 : 0,
                }}
              />
              <motion.ellipse
                cx={56}
                cy={42}
                rx={3.5}
                animate={{ ry: eyeRy }}
                transition={{ duration: BLINK_DURATION }}
                fill="white"
              />
              <motion.circle
                r={2}
                fill="oklch(0.15 0.01 260)"
                animate={{ opacity: pupilOpacity }}
                transition={{ duration: BLINK_DURATION }}
                style={{
                  cx: trackMouse ? pupilOffsetX : 56,
                  cy: trackMouse ? pupilOffsetY : 42,
                  x: trackMouse ? 56 : 0,
                  y: trackMouse ? 42 : 0,
                }}
              />
            </motion.g>
            {/* close 3D turn */}
          </motion.g>
          {/* close wiggle */}

          {/* Feet — pointing down (standing) or forward (sitting) */}
          {effectiveVariant === 'sit' ? (
            <>
              <polygon points="34,105 34,112 48,114 48,108" fill="oklch(0.68 0.14 165)" />
              <polygon points="54,105 54,112 68,114 68,108" fill="oklch(0.68 0.14 165)" />
            </>
          ) : (
            <>
              <polygon points="36,105 44,105 40,115" fill="oklch(0.68 0.14 165)" />
              <polygon points="56,105 64,105 60,115" fill="oklch(0.68 0.14 165)" />
            </>
          )}

          {/* Left arm — attached at left body edge (x≈33), pivots at shoulder */}
          <motion.g
            variants={leftArmVariants}
            animate={effectiveVariant === 'run' ? RUN_LEFT_ARM : effectiveVariant}
            transition={effectiveVariant === 'run' ? RUN_LEFT_ARM_T : undefined}
            style={{ originX: '34px', originY: '58px' }}
          >
            <polygon points="34,58 30,70 26,68 30,56" fill="oklch(0.72 0.15 165)" />
          </motion.g>

          {/* Right arm — attached at right body edge (x≈66), pivots at shoulder */}
          <motion.g
            variants={rightArmVariants}
            animate={effectiveVariant === 'run' ? RUN_RIGHT_ARM : effectiveVariant}
            transition={effectiveVariant === 'run' ? RUN_RIGHT_ARM_T : undefined}
            style={{ originX: '66px', originY: '58px' }}
          >
            <polygon points="66,58 70,70 74,68 70,56" fill="oklch(0.72 0.15 165)" />
          </motion.g>
        </motion.g>
        {/* close body variants */}
      </motion.g>
      {/* close celebration/dance wrapper */}

      {/* ── RIGHT CHARACTER (Coral) ── */}
      <motion.g
        animate={rightCelebrate ?? rightDance}
        transition={rightCelebrateT ?? rightDanceT}
        style={{ originX: '150px', originY: '90px' }}
      >
        <motion.g
          variants={rightBodyVariants}
          animate={effectiveVariant}
          initial="idle"
          style={{ originX: '150px', originY: '90px' }}
        >
          {/* Body */}
          <polygon
            points="135,55 165,55 170,105 130,105"
            fill="var(--color-coral, oklch(0.72 0.19 35))"
          />
          <polygon points="135,55 130,105 132,55" fill="oklch(0.58 0.17 35)" />

          {/* Head — wiggle wrapper + 3D turn */}
          <motion.g
            animate={wiggleHead}
            transition={wiggleHeadT}
            style={{ originX: '150px', originY: '42px' }}
          >
            <motion.g
              style={{
                originX: '150px',
                originY: '42px',
                skewY: trackMouse ? headSkewY : 0,
                x: trackMouse ? headTranslateX : 0,
                y: trackMouse ? headTranslateY : 0,
              }}
            >
              <polygon
                points="138,28 162,28 167,55 150,58 133,55"
                fill="var(--color-coral, oklch(0.72 0.19 35))"
              />
              <polygon
                points="138,28 162,28 160,38 140,38"
                fill="oklch(0.82 0.14 35)"
                opacity={0.5}
              />

              {/* Eyes */}
              <motion.ellipse
                cx={144}
                cy={42}
                rx={3.5}
                animate={{ ry: eyeRy }}
                transition={{ duration: BLINK_DURATION }}
                fill="white"
              />
              <motion.circle
                r={2}
                fill="oklch(0.15 0.01 260)"
                animate={{ opacity: pupilOpacity }}
                transition={{ duration: BLINK_DURATION }}
                style={{
                  cx: trackMouse ? pupilOffsetX : 144,
                  cy: trackMouse ? pupilOffsetY : 42,
                  x: trackMouse ? 144 : 0,
                  y: trackMouse ? 42 : 0,
                }}
              />
              <motion.ellipse
                cx={156}
                cy={42}
                rx={3.5}
                animate={{ ry: eyeRy }}
                transition={{ duration: BLINK_DURATION }}
                fill="white"
              />
              <motion.circle
                r={2}
                fill="oklch(0.15 0.01 260)"
                animate={{ opacity: pupilOpacity }}
                transition={{ duration: BLINK_DURATION }}
                style={{
                  cx: trackMouse ? pupilOffsetX : 156,
                  cy: trackMouse ? pupilOffsetY : 42,
                  x: trackMouse ? 156 : 0,
                  y: trackMouse ? 42 : 0,
                }}
              />
            </motion.g>
            {/* close 3D turn */}
          </motion.g>
          {/* close wiggle */}

          {/* Feet — pointing down (standing) or forward (sitting) */}
          {effectiveVariant === 'sit' ? (
            <>
              <polygon points="134,105 134,112 148,114 148,108" fill="oklch(0.60 0.16 35)" />
              <polygon points="154,105 154,112 168,114 168,108" fill="oklch(0.60 0.16 35)" />
            </>
          ) : (
            <>
              <polygon points="136,105 144,105 140,115" fill="oklch(0.60 0.16 35)" />
              <polygon points="156,105 164,105 160,115" fill="oklch(0.60 0.16 35)" />
            </>
          )}

          {/* Left arm — attached at left body edge (x≈133), pivots at shoulder */}
          <motion.g
            variants={leftArmVariants}
            animate={effectiveVariant === 'run' ? RUN_LEFT_ARM : effectiveVariant}
            transition={effectiveVariant === 'run' ? RUN_LEFT_ARM_T : undefined}
            style={{ originX: '134px', originY: '58px' }}
          >
            <polygon points="134,58 130,70 126,68 130,56" fill="oklch(0.62 0.16 35)" />
          </motion.g>

          {/* Right arm — attached at right body edge (x≈166), pivots at shoulder */}
          <motion.g
            variants={rightArmVariants}
            animate={effectiveVariant === 'run' ? RUN_RIGHT_ARM : effectiveVariant}
            transition={effectiveVariant === 'run' ? RUN_RIGHT_ARM_T : undefined}
            style={{ originX: '166px', originY: '58px' }}
          >
            <polygon points="166,58 170,70 174,68 170,56" fill="oklch(0.62 0.16 35)" />
          </motion.g>
        </motion.g>
        {/* close body variants */}
      </motion.g>
      {/* close celebration/dance wrapper */}
    </motion.svg>
  );
}
