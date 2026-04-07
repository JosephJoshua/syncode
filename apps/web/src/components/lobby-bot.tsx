import { cn } from '@syncode/ui';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

type BotMood = 'sleeping' | 'waiting' | 'alert' | 'excited';

function resolveMood(readyCount: number, totalCount: number): BotMood {
  if (totalCount === 0) return 'sleeping';
  if (readyCount === totalCount) return 'excited';
  if (readyCount > 0) return 'alert';
  return 'waiting';
}

export function LobbyBot({
  readyCount,
  totalCount,
  className,
}: {
  readyCount: number;
  totalCount: number;
  className?: string;
}) {
  const mood = resolveMood(readyCount, totalCount);
  const progress = totalCount > 0 ? readyCount / totalCount : 0;
  const svgRef = useRef<SVGSVGElement>(null);

  const glowSpring = useSpring(0, { stiffness: 80, damping: 20 });
  const glowShadow = useTransform(
    glowSpring,
    [0, 1],
    [
      '0 0 0px oklch(0.82 0.18 165 / 0), inset 0 0 0px oklch(0.82 0.18 165 / 0)',
      '0 0 24px oklch(0.82 0.18 165 / 0.5), inset 0 0 10px oklch(0.82 0.18 165 / 0.12)',
    ],
  );

  useEffect(() => {
    glowSpring.set(progress);
  }, [progress, glowSpring]);

  const gazeX = useMotionValue(0);
  const gazeY = useMotionValue(0);
  const smoothGazeX = useSpring(gazeX, { stiffness: 150, damping: 20 });
  const smoothGazeY = useSpring(gazeY, { stiffness: 150, damping: 20 });

  const leftPupilCx = useTransform(smoothGazeX, (v) => 38 + v);
  const leftPupilCy = useTransform(smoothGazeY, (v) => 47 + v);
  const rightPupilCx = useTransform(smoothGazeX, (v) => 62 + v);
  const rightPupilCy = useTransform(smoothGazeY, (v) => 47 + v);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (mood === 'sleeping' || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxOffset = 3;
      const scale = Math.min(maxOffset / Math.max(dist * 0.015, 1), maxOffset);
      gazeX.set(Math.max(-maxOffset, Math.min(maxOffset, dx * 0.015 * scale)));
      gazeY.set(Math.max(-maxOffset, Math.min(maxOffset, dy * 0.015 * scale)));
    },
    [mood, gazeX, gazeY],
  );

  useEffect(() => {
    globalThis.addEventListener('mousemove', handleMouseMove);
    return () => globalThis.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Reset gaze when sleeping
  useEffect(() => {
    if (mood === 'sleeping') {
      gazeX.set(0);
      gazeY.set(0);
    }
  }, [mood, gazeX, gazeY]);

  const eyeRy = mood === 'sleeping' ? 1 : mood === 'excited' ? 4 : 4.5;
  const eyeRx = mood === 'sleeping' ? 5.5 : mood === 'excited' ? 3.5 : 4;
  const eyeBaseY = mood === 'sleeping' ? 50 : 47;
  const eyeColor = mood === 'excited' ? 'oklch(0.82 0.18 165)' : 'oklch(0.82 0.01 286)';

  const mouthScaleY =
    mood === 'sleeping' ? 0 : mood === 'waiting' ? 0.2 : mood === 'alert' ? 0.6 : 1;
  const mouthColor = mood === 'excited' ? 'oklch(0.82 0.18 165)' : 'oklch(0.50 0.01 286)';

  const ledColor =
    mood === 'excited'
      ? 'oklch(0.82 0.18 165)'
      : mood === 'alert'
        ? 'oklch(0.82 0.18 165 / 0.6)'
        : 'oklch(0.35 0.01 286)';

  const screenFill = mood === 'excited' ? 'oklch(0.18 0.01 165)' : 'oklch(0.17 0.005 286)';

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      {/* Glow behind the face */}
      <motion.div className="absolute inset-0 rounded-2xl" style={{ boxShadow: glowShadow }} />

      {/* Gentle idle float */}
      <motion.svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="relative size-24"
        aria-hidden="true"
        animate={{ y: [0, -2.5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Head */}
        <rect
          x="10"
          y="10"
          width="80"
          height="80"
          rx="22"
          fill="oklch(0.20 0.005 286)"
          stroke="oklch(0.30 0.005 286)"
          strokeWidth="1.2"
        />

        {/* Screen inset */}
        <motion.rect
          x="17"
          y="17"
          width="66"
          height="66"
          rx="15"
          stroke="oklch(0.25 0.005 286)"
          strokeWidth="0.5"
          animate={{ fill: screenFill }}
          transition={{ duration: 0.5 }}
        />

        {/* Status LED with pulse for excited */}
        <motion.circle
          cx="50"
          cy="29"
          r="1.8"
          animate={{
            fill: ledColor,
            scale: mood === 'excited' ? [1, 1.4, 1] : 1,
          }}
          transition={
            mood === 'excited'
              ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.4 }
          }
        />

        {/* Left eye */}
        <motion.ellipse
          rx={eyeRx}
          ry={eyeRy}
          animate={{
            cx: mood === 'sleeping' ? 38 : undefined,
            cy: mood === 'sleeping' ? eyeBaseY : undefined,
            rx: eyeRx,
            ry: eyeRy,
            fill: eyeColor,
          }}
          style={{
            cx: mood === 'sleeping' ? undefined : leftPupilCx,
            cy: mood === 'sleeping' ? undefined : leftPupilCy,
          }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        />

        {/* Right eye */}
        <motion.ellipse
          rx={eyeRx}
          ry={eyeRy}
          animate={{
            cx: mood === 'sleeping' ? 62 : undefined,
            cy: mood === 'sleeping' ? eyeBaseY : undefined,
            rx: eyeRx,
            ry: eyeRy,
            fill: eyeColor,
          }}
          style={{
            cx: mood === 'sleeping' ? undefined : rightPupilCx,
            cy: mood === 'sleeping' ? undefined : rightPupilCy,
          }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        />

        {/* Blink overlay (waiting mood) */}
        {mood === 'waiting' && (
          <>
            <motion.rect
              x="29"
              y="39"
              width="18"
              height="16"
              rx="5"
              fill={screenFill}
              animate={{ scaleY: [0, 0, 1, 0, 0] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                times: [0, 0.44, 0.48, 0.52, 1],
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '38px 47px' }}
            />
            <motion.rect
              x="53"
              y="39"
              width="18"
              height="16"
              rx="5"
              fill={screenFill}
              animate={{ scaleY: [0, 0, 1, 0, 0] }}
              transition={{
                duration: 3.5,
                delay: 0.03,
                repeat: Infinity,
                times: [0, 0.44, 0.48, 0.52, 1],
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '62px 47px' }}
            />
          </>
        )}

        {/* Mouth */}
        <motion.path
          d="M 38 62 Q 50 72 62 62"
          fill="none"
          strokeLinecap="round"
          strokeWidth="1.8"
          animate={{
            scaleY: mouthScaleY,
            stroke: mouthColor,
          }}
          transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          style={{ transformOrigin: '50px 62px' }}
        />

        {/* Zzz for sleeping */}
        {mood === 'sleeping' && (
          <motion.text
            x="70"
            y="34"
            fontSize="9"
            fill="oklch(0.42 0.01 286)"
            fontFamily="monospace"
            animate={{ opacity: [0, 0.7, 0], y: [36, 30, 24] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            z
          </motion.text>
        )}
      </motion.svg>
    </div>
  );
}
