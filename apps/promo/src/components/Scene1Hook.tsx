import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene1FloatingPanels } from './Scene1FloatingPanels';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';

const ORBS = [
  { x: 12, y: 18, size: 520, color: 'rgba(99,102,241,0.09)' },
  { x: 78, y: 72, size: 420, color: 'rgba(139,92,246,0.07)' },
  { x: 62, y: 10, size: 320, color: 'rgba(59,130,246,0.06)' },
  { x: 25, y: 80, size: 280, color: 'rgba(168,85,247,0.05)' },
];

export const Scene1Hook = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const orbDrift = interpolate(frame, [0, durationInFrames], [0, 1]);

  const ruleWidth = interpolate(frame, [4, 28], [0, 220], { extrapolateRight: 'clamp' });
  const ruleOpacity = interpolate(frame, [4, 20], [0, 0.4], { extrapolateRight: 'clamp' });

  const fadeIn = interpolate(frame, [16, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const letterSpacing = interpolate(frame, [16, 48], [6, -1.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subOpacity = interpolate(frame, [44, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subY = interpolate(frame, [44, 62], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const surgeScale = interpolate(frame, [68, 96], [1, 4.8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const surgeOpacity = interpolate(frame, [68, 92], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const surgeBlur = interpolate(frame, [68, 96], [0, 30], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isSurging = frame >= 68;
  const opacity = isSurging ? surgeOpacity : fadeIn;
  const scale = isSurging ? surgeScale : 1;
  const blur = isSurging ? surgeBlur : 0;

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 40%, #150d2e 0%, #0a0614 55%, #000 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Floating orbs */}
      {ORBS.map((orb, i) => {
        const driftX = 18 * Math.sin(orbDrift * Math.PI * 2 + i * 1.4);
        const driftY = 14 * Math.cos(orbDrift * Math.PI * 2 + i * 0.9);
        return (
          <div
            key={orb.color}
            style={{
              position: 'absolute',
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              width: orb.size,
              height: orb.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              transform: `translate(-50%, -50%) translate(${driftX}px, ${driftY}px)`,
              pointerEvents: 'none',
            }}
          />
        );
      })}

      {/* Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      <Scene1FloatingPanels />

      {/* Center content */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: ruleWidth,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(165,180,252,0.6), transparent)',
            opacity: ruleOpacity,
            marginBottom: 36,
          }}
        />

        <div
          style={{
            opacity,
            transform: `scale(${scale})`,
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
            textAlign: 'center',
            maxWidth: 1000,
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 86,
              fontWeight: 800,
              letterSpacing: `${letterSpacing}px`,
              lineHeight: 1.1,
              fontFamily: FONT,
              background: 'linear-gradient(135deg, #ffffff 0%, #c7d2fe 50%, #a5b4fc 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Practicing code alone
            <br />
            is tough.
          </div>

          <div
            style={{
              opacity: subOpacity * (isSurging ? surgeOpacity : 1),
              transform: `translateY(${subY}px)`,
              marginTop: 24,
              fontSize: 20,
              fontWeight: 400,
              color: 'rgba(165,180,252,0.5)',
              fontFamily: FONT,
              letterSpacing: '0.3px',
            }}
          >
            Every developer has been there.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
