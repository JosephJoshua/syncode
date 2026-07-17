import { motion } from 'motion/react';
import { useMemo } from 'react';

const PARTICLE_COUNT = 64;
const COLORS = [
  'oklch(0.82 0.18 165)',
  'oklch(0.75 0.14 165)',
  'oklch(0.85 0.12 180)',
  'oklch(0.70 0.10 200)',
  'oklch(0.90 0.08 165)',
  'oklch(0.65 0.16 140)',
  'oklch(0.78 0.20 155)',
  'oklch(0.88 0.10 190)',
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ConfettiBurst() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * 360 + randomBetween(-15, 15);
        const rad = (angle * Math.PI) / 180;
        const dist = randomBetween(120, 420);
        const gravity = randomBetween(40, 120);
        return {
          id: i,
          x: Math.cos(rad) * dist,
          y: Math.sin(rad) * dist * 0.7 + gravity,
          rotation: randomBetween(0, 1080),
          color: COLORS[i % COLORS.length],
          width: randomBetween(5, 10),
          height: randomBetween(3, 8),
          delay: randomBetween(0, 0.25),
          duration: randomBetween(1.4, 2.2),
          shape: Math.random() > 0.6 ? ('circle' as const) : ('rect' as const),
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <div className="absolute left-1/2 top-1/3">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: p.width,
              height: p.shape === 'circle' ? p.width : p.height,
              backgroundColor: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : '2px',
              left: -p.width / 2,
              top: -p.height / 2,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: [1, 1, 1, 0],
              scale: [0, 1.4, 1, 0.6],
              rotate: p.rotation,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      </div>
    </div>
  );
}
