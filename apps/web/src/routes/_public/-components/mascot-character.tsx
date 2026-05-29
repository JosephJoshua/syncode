import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Mood = 'hover' | 'dart' | 'land';

interface MascotCharacterProps {
  readonly color: 'cyan' | 'coral';
  readonly size?: number;
  readonly className?: string;
  readonly mood?: Mood;
  readonly lookAngle?: number;
  readonly arms?: boolean;
  readonly trackCursor?: boolean;
}

const EYE_RY: Record<Mood, number> = { hover: 4.5, dart: 3.2, land: 5.2 };
const mouseSpring = { stiffness: 150, damping: 12 };

/* ── Spring-driven limb motion ──────────────────────────────────
 * Uses a continuous phase that never resets. When mood changes,
 * the amplitude and frequency shift smoothly via spring physics.
 * No abrupt keyframe-array snap.
 * ─────────────────────────────────────────────────────────────── */
function useLimbMotion(mood: Mood) {
  const phase = useRef(Math.random() * Math.PI * 2);
  const landAt = useRef(0);

  const leftArm = useMotionValue(0);
  const rightArm = useMotionValue(0);
  const leftLeg = useMotionValue(0);
  const rightLeg = useMotionValue(0);

  const springL = useSpring(leftArm, { stiffness: 180, damping: 20 });
  const springR = useSpring(rightArm, { stiffness: 180, damping: 20 });
  const springLL = useSpring(leftLeg, { stiffness: 200, damping: 22 });
  const springRL = useSpring(rightLeg, { stiffness: 200, damping: 22 });

  useAnimationFrame((_, delta) => {
    const freq = mood === 'dart' ? 0.018 : 0.0055;
    let amp: number;
    if (mood === 'dart') {
      amp = 16;
    } else if (mood === 'land') {
      const elapsed = Date.now() - landAt.current;
      amp = Math.max(0, 10 * (1 - elapsed / 600));
    } else {
      amp = 5;
    }

    if (mood === 'land' && landAt.current === 0) landAt.current = Date.now();
    if (mood !== 'land') landAt.current = 0;

    phase.current += delta * freq;
    const s = Math.sin(phase.current);
    leftArm.set(s * amp);
    rightArm.set(-s * amp);
    const legAmp = mood === 'dart' ? 8 : 0;
    leftLeg.set(-s * legAmp);
    rightLeg.set(s * legAmp);
  });

  return {
    leftArmAngle: springL,
    rightArmAngle: springR,
    leftLegAngle: springLL,
    rightLegAngle: springRL,
  };
}

export function MascotCharacter({
  color,
  size = 80,
  className,
  mood = 'hover',
  lookAngle = 0,
  arms = false,
  trackCursor = false,
}: MascotCharacterProps) {
  const prefersReducedMotion = useReducedMotion();
  const isCyan = color === 'cyan';
  const fill = isCyan
    ? 'var(--color-primary, oklch(0.82 0.18 165))'
    : 'var(--color-coral, oklch(0.72 0.19 35))';
  const shadow = isCyan ? 'oklch(0.65 0.16 165)' : 'oklch(0.58 0.17 35)';
  const foot = isCyan ? 'oklch(0.68 0.14 165)' : 'oklch(0.60 0.16 35)';
  const highlight = isCyan ? 'oklch(0.88 0.15 165)' : 'oklch(0.82 0.14 35)';
  const pupil = 'oklch(0.15 0.01 260)';

  const aspect = 40 / 90;
  const height = size;
  const width = height * aspect;

  const eyeRy = EYE_RY[mood];
  const [blink, setBlink] = useState(false);
  const limbs = useLimbMotion(mood);

  useEffect(() => {
    if (mood === 'dart') return;
    const schedule = (): ReturnType<typeof setTimeout> => {
      const delay = 2000 + Math.random() * 4000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 120);
        timer = schedule();
      }, delay);
    };
    let timer = schedule();
    return () => clearTimeout(timer);
  }, [mood]);

  // ── Cursor tracking (like PairMascot hero section) ──────────
  const rawMouseX = useMotionValue(0.5);
  const rawMouseY = useMotionValue(0.5);
  const mouseX = useSpring(rawMouseX, mouseSpring);
  const mouseY = useSpring(rawMouseY, mouseSpring);

  const headSkewY = useTransform(mouseX, [0, 1], [-4, 4]);
  const headTranslateX = useTransform(mouseX, [0, 1], [-3, 3]);
  const headTranslateY = useTransform(mouseY, [0, 1], [-2, 2]);

  const pupilOffsetX = useTransform(mouseX, [0, 1], [-2.5, 2.5]);
  const pupilOffsetY = useTransform(mouseY, [0, 1], [-1.5, 1.5]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      rawMouseX.set(e.clientX / window.innerWidth);
      rawMouseY.set(e.clientY / window.innerHeight);
    },
    [rawMouseX, rawMouseY],
  );

  useEffect(() => {
    if (!trackCursor || prefersReducedMotion) return;
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [trackCursor, prefersReducedMotion, handleMouseMove]);

  const currentRy = blink ? 0.3 : eyeRy;

  return (
    <motion.svg
      viewBox="25 20 50 100"
      overflow="visible"
      width={width}
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`${color} mascot character`}
    >
      {/* ── Body (static) ── */}
      <g>
        <polygon points="35,55 65,55 70,105 30,105" fill={fill} />
        <polygon
          points={isCyan ? '65,55 70,105 70,105 68,55' : '35,55 30,105 32,55'}
          fill={shadow}
        />

        {/* ── Head ── */}
        {trackCursor ? (
          <motion.g
            style={{
              originX: '50px',
              originY: '42px',
              skewY: headSkewY,
              x: headTranslateX,
              y: headTranslateY,
            }}
          >
            <polygon points="38,28 62,28 67,55 50,58 33,55" fill={fill} />
            <polygon points="38,28 62,28 60,38 40,38" fill={highlight} opacity={0.5} />
            {/* Eyes — pupils track cursor via cx/cy (same as PairMascot) */}
            <motion.ellipse
              cx={44}
              cy={42}
              rx={3.5}
              ry={eyeRy}
              animate={{ ry: currentRy }}
              transition={{ duration: blink ? 0.06 : 0.25 }}
              fill="white"
            />
            <motion.circle
              style={{ cx: pupilOffsetX, cy: pupilOffsetY, x: 44, y: 42 }}
              r={2}
              fill={pupil}
            />
            <motion.ellipse
              cx={56}
              cy={42}
              rx={3.5}
              ry={eyeRy}
              animate={{ ry: currentRy }}
              transition={{ duration: blink ? 0.06 : 0.25 }}
              fill="white"
            />
            <motion.circle
              style={{ cx: pupilOffsetX, cy: pupilOffsetY, x: 56, y: 42 }}
              r={2}
              fill={pupil}
            />
          </motion.g>
        ) : (
          <motion.g
            animate={{ rotate: -lookAngle * 0.12 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            style={{ originX: '50px', originY: '42px' }}
          >
            <polygon points="38,28 62,28 67,55 50,58 33,55" fill={fill} />
            <polygon points="38,28 62,28 60,38 40,38" fill={highlight} opacity={0.5} />
            {/* Pupils track firefly direction */}
            <motion.g
              animate={{ x: -lookAngle * 0.04, y: -lookAngle * 0.02 }}
              transition={{ type: 'spring', stiffness: 150, damping: 22 }}
            >
              <motion.ellipse
                cx={44}
                cy={42}
                rx={3.5}
                ry={eyeRy}
                animate={{ ry: currentRy }}
                transition={{ duration: blink ? 0.06 : 0.25 }}
                fill="white"
              />
              <circle cx={44} cy={42} r={2} fill={pupil} />
              <motion.ellipse
                cx={56}
                cy={42}
                rx={3.5}
                ry={eyeRy}
                animate={{ ry: currentRy }}
                transition={{ duration: blink ? 0.06 : 0.25 }}
                fill="white"
              />
              <circle cx={56} cy={42} r={2} fill={pupil} />
            </motion.g>
          </motion.g>
        )}

        {/* ── Arms (opt-in, static) ── */}
        {arms ? (
          <>
            <polygon points="34,56 26,72 30,74 36,60" fill={fill} />
            <polygon points="66,56 74,72 70,74 64,60" fill={fill} />
          </>
        ) : null}

        {/* ── Feet — spring-driven kick ── */}
        <motion.g style={{ rotate: limbs.leftLegAngle, originX: '40px', originY: '108px' }}>
          <polygon points="36,105 44,105 40,115" fill={foot} />
        </motion.g>
        <motion.g style={{ rotate: limbs.rightLegAngle, originX: '60px', originY: '108px' }}>
          <polygon points="56,105 64,105 60,115" fill={foot} />
        </motion.g>
      </g>
    </motion.svg>
  );
}
