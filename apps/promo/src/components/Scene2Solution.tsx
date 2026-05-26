import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const GREEN = '#4ade80';

const BADGES = [
  { label: 'AI Interviewer', icon: '◆', delay: 48 },
  { label: 'Peer Collaboration', icon: '◈', delay: 62 },
  { label: 'Session Replay', icon: '◇', delay: 76 },
];

const Badge = ({
  label,
  icon,
  delay,
  frame,
  fps,
}: {
  label: string;
  icon: string;
  delay: number;
  frame: number;
  fps: number;
}) => {
  const p = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { stiffness: 200, damping: 22, mass: 0.7 },
  });
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 0.4], [0, 1]),
        transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(74,222,128,0.07)',
        border: '1px solid rgba(74,222,128,0.25)',
        borderRadius: 100,
        padding: '10px 22px',
        fontSize: 15,
        fontWeight: 600,
        color: GREEN,
        fontFamily: FONT,
        letterSpacing: '0.2px',
      }}
    >
      <span style={{ fontSize: 10, color: 'rgba(74,222,128,0.6)' }}>{icon}</span>
      {label}
    </div>
  );
};

export const Scene2Solution = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  // Expanding ring
  const ringScale = interpolate(frame, [0, durationInFrames], [0.6, 2.4]);
  const ringOpacity = interpolate(
    frame,
    [0, 20, durationInFrames - 30, durationInFrames],
    [0, 0.18, 0.08, 0],
  );

  // Second ring (offset)
  const ring2Scale = interpolate(frame, [0, durationInFrames], [0.4, 1.8]);
  const ring2Opacity = interpolate(
    frame,
    [10, 30, durationInFrames - 30, durationInFrames],
    [0, 0.12, 0.04, 0],
  );

  // Heading
  const headP = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { stiffness: 130, damping: 18 },
  });
  const headY = interpolate(headP, [0, 1], [50, 0]);
  const headOpacity = interpolate(headP, [0, 0.4], [0, 1]);

  // Pulsing glow
  const glow = 32 + 16 * Math.sin(frame * 0.12);
  const glowOuter = 64 + 32 * Math.sin(frame * 0.12 + 0.5);

  // Sub
  const subP = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { stiffness: 110, damping: 20 },
  });
  const subOpacity = interpolate(subP, [0, 0.5], [0, 1]);
  const subY = interpolate(subP, [0, 1], [14, 0]);

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 55%, #061a0d 0%, #030e07 50%, #000 100%)',
        overflow: 'hidden',
        opacity: enter * exit,
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(74,222,128,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.025) 1px, transparent 1px)',
          backgroundSize: '90px 90px',
          pointerEvents: 'none',
        }}
      />

      {/* Expanding rings */}
      {[
        { s: ringScale, o: ringOpacity },
        { s: ring2Scale, o: ring2Opacity },
      ].map(({ s, o }, i) => (
        <div
          key={i === 0 ? 'ring1' : 'ring2'}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 700,
            height: 700,
            borderRadius: '50%',
            border: '1px solid rgba(74,222,128,0.4)',
            transform: `translate(-50%, -50%) scale(${s})`,
            opacity: o,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Center radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Heading */}
        <div
          style={{
            opacity: headOpacity,
            transform: `translateY(${headY}px)`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: GREEN,
              letterSpacing: '-2.5px',
              lineHeight: 1,
              fontFamily: FONT,
              textShadow: `0 0 ${glow}px rgba(74,222,128,0.75), 0 0 ${glowOuter}px rgba(74,222,128,0.3), 0 0 ${glowOuter * 2}px rgba(74,222,128,0.1)`,
            }}
          >
            We made it easy.
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            marginTop: 24,
            fontSize: 22,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.38)',
            fontFamily: FONT,
            letterSpacing: '0.3px',
          }}
        >
          Everything you need to ace your next interview.
        </div>

        {/* Divider */}
        <div
          style={{
            opacity: subOpacity * 0.3,
            width: 1,
            height: 40,
            background: 'linear-gradient(to bottom, rgba(74,222,128,0.4), transparent)',
            marginTop: 32,
          }}
        />

        {/* Badges */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 24,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {BADGES.map((b) => (
            <Badge key={b.label} {...b} frame={frame} fps={fps} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
