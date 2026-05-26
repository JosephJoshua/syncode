import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene5AiPanel } from './Scene5AiPanel';
import { Scene5Report } from './Scene5Report';

export const Scene5Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reportP = spring({
    frame: Math.max(0, frame - 68),
    fps,
    config: { stiffness: 120, damping: 17 },
  });
  const ambientOpacity = interpolate(reportP, [0, 0.6], [0, 1]);

  const wordP = spring({
    frame: Math.max(0, frame - 196),
    fps,
    config: { stiffness: 100, damping: 18 },
  });
  const wordOpacity = interpolate(wordP, [0, 0.5], [0, 1]);

  const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 45%, #0e0a1c 0%, #080612 55%, #000 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      <Scene5AiPanel />

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 900,
          height: 900,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(139,92,246,0.13) 0%, transparent 65%)',
          opacity: ambientOpacity,
          pointerEvents: 'none',
        }}
      />

      <Scene5Report />

      {/* Wordmark */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: wordOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: FONT,
            letterSpacing: '-0.3px',
          }}
        >
          SynCode
        </div>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontFamily: FONT }}>
          syncode.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
