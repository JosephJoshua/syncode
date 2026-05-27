import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

export const Scene3Transition = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const exit = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  // Transition text
  const textP = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { stiffness: 120, damping: 20 },
  });
  const textOpacity =
    interpolate(textP, [0, 0.5], [0, 1]) *
    interpolate(frame, [44, 62], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textY = interpolate(textP, [0, 1], [20, 0]);

  // Shimmer sweep across heading text
  const shimmerX = interpolate(frame, [10, 58], [-18, 118], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Panel
  const panelP = spring({
    frame: Math.max(0, frame - 52),
    fps,
    config: { stiffness: 175, damping: 16, mass: 0.88 },
  });
  const panelScale = interpolate(panelP, [0, 1], [0.84, 1]);
  const panelOpacity =
    interpolate(panelP, [0, 0.35], [0, 1]) *
    interpolate(frame, [durationInFrames - 24, durationInFrames - 6], [1, 0], {
      extrapolateLeft: 'clamp',
    });
  const panelY = interpolate(panelP, [0, 1], [56, 0]);

  // Glow behind panel
  const glowOpacity =
    interpolate(panelP, [0, 0.6], [0, 1]) *
    interpolate(frame, [durationInFrames - 24, durationInFrames - 6], [1, 0], {
      extrapolateLeft: 'clamp',
    });

  // Staggered fields
  const f1 = interpolate(Math.max(0, frame - 72), [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const f2 = interpolate(Math.max(0, frame - 86), [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const f3 = interpolate(Math.max(0, frame - 100), [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const btnP = spring({
    frame: Math.max(0, frame - 114),
    fps,
    config: { stiffness: 220, damping: 20 },
  });
  const btnScale = interpolate(btnP, [0, 1], [0.88, 1]);
  const btnOpacity = interpolate(btnP, [0, 0.4], [0, 1]);

  const fieldStyle = (f: number) => ({
    opacity: f,
    transform: `translateY(${interpolate(f, [0, 1], [10, 0])}px)`,
  });

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 45%, #0a0f1e 0%, #060810 55%, #000 100%)',
        overflow: 'hidden',
        opacity: exit,
      }}
    >
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

      {/* Corner accent lines */}
      {(
        [
          {
            id: 'tl',
            top: 40,
            left: 40,
            borderTop: true,
            borderBottom: false,
            borderLeft: true,
            borderRight: false,
          },
          {
            id: 'tr',
            top: 40,
            right: 40,
            borderTop: true,
            borderBottom: false,
            borderLeft: false,
            borderRight: true,
          },
          {
            id: 'bl',
            bottom: 40,
            left: 40,
            borderTop: false,
            borderBottom: true,
            borderLeft: true,
            borderRight: false,
          },
          {
            id: 'br',
            bottom: 40,
            right: 40,
            borderTop: false,
            borderBottom: true,
            borderLeft: false,
            borderRight: true,
          },
        ] as const
      ).map(({ id, borderTop, borderBottom, borderLeft, borderRight, ...pos }) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            ...pos,
            width: 40,
            height: 40,
            borderTop: borderTop ? '1px solid rgba(99,102,241,0.2)' : 'none',
            borderBottom: borderBottom ? '1px solid rgba(99,102,241,0.2)' : 'none',
            borderLeft: borderLeft ? '1px solid rgba(99,102,241,0.2)' : 'none',
            borderRight: borderRight ? '1px solid rgba(99,102,241,0.2)' : 'none',
            opacity: exit * 0.6,
          }}
        />
      ))}

      {/* Transition text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, calc(-50% + ${textY}px))`,
          opacity: textOpacity,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Base gradient text — always readable */}
        <div
          style={{
            fontSize: 46,
            fontWeight: 600,
            fontFamily: FONT,
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            position: 'relative',
          }}
        >
          Let me show you how this works.
          {/* Shimmer stripe: transparent everywhere except the narrow moving band */}
          <span
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(105deg, transparent ${shimmerX - 6}%, rgba(255,255,255,0.85) ${shimmerX}%, transparent ${shimmerX + 6}%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              pointerEvents: 'none',
            }}
          >
            Let me show you how this works.
          </span>
        </div>
      </div>

      {/* Glow behind panel */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 800,
          height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)',
          opacity: glowOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Glass panel */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, calc(-50% + ${panelY}px)) scale(${panelScale})`,
          opacity: panelOpacity,
          width: 680,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.035)',
            backdropFilter: 'blur(48px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 24,
            padding: '40px 44px',
            boxShadow:
              '0 48px 140px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 60px rgba(99,102,241,0.08) inset',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 36,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  fontFamily: FONT,
                  letterSpacing: '-0.3px',
                }}
              >
                Create Session
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: FONT,
                  marginTop: 4,
                }}
              >
                Start a collaborative interview
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
                border: '1px solid rgba(99,102,241,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: '#a5b4fc',
              }}
            >
              +
            </div>
          </div>

          {/* Field 1 — Problem */}
          <div style={{ marginBottom: 18, ...fieldStyle(f1) }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.28)',
                fontFamily: FONT,
                letterSpacing: '0.9px',
                textTransform: 'uppercase',
                marginBottom: 9,
              }}
            >
              Problem
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4ade80',
                    boxShadow: '0 0 6px #4ade80',
                  }}
                />
                <span style={{ fontSize: 15, color: '#fff', fontFamily: FONT, fontWeight: 500 }}>
                  Two Sum
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#4ade80',
                    background: 'rgba(74,222,128,0.1)',
                    border: '1px solid rgba(74,222,128,0.2)',
                    borderRadius: 5,
                    padding: '2px 8px',
                    fontFamily: FONT,
                  }}
                >
                  Easy
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}>›</span>
            </div>
          </div>

          {/* Field 2 — Collaborator */}
          <div style={{ marginBottom: 18, ...fieldStyle(f2) }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.28)',
                fontFamily: FONT,
                letterSpacing: '0.9px',
                textTransform: 'uppercase',
                marginBottom: 9,
              }}
            >
              Invite Collaborator
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: '#fff',
                  fontWeight: 700,
                  fontFamily: FONT,
                }}
              >
                A
              </div>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontFamily: MONO }}>
                alice@syncode.dev
              </span>
              <div
                style={{
                  marginLeft: 'auto',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#4ade80',
                  boxShadow: '0 0 6px #4ade80',
                }}
              />
            </div>
          </div>

          {/* Field 3 — Mode */}
          <div style={{ marginBottom: 32, ...fieldStyle(f3) }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.28)',
                fontFamily: FONT,
                letterSpacing: '0.9px',
                textTransform: 'uppercase',
                marginBottom: 9,
              }}
            >
              Mode
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(
                [
                  { label: 'AI Interview', active: true },
                  { label: 'Practice', active: false },
                ] as const
              ).map(({ label, active }) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: 10,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: FONT,
                    background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                    border: active
                      ? '1px solid rgba(99,102,241,0.4)'
                      : '1px solid rgba(255,255,255,0.07)',
                    color: active ? '#a5b4fc' : 'rgba(255,255,255,0.28)',
                    boxShadow: active ? '0 0 20px rgba(99,102,241,0.1) inset' : 'none',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              opacity: btnOpacity,
              transform: `scale(${btnScale})`,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 14,
              padding: '15px 0',
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: FONT,
              color: '#fff',
              letterSpacing: '0.1px',
              boxShadow: '0 8px 32px rgba(99,102,241,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }}
          >
            Start Session →
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
