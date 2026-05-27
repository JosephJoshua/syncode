import { interpolate, useCurrentFrame } from 'remotion';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

const panelCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
};

export const Scene1FloatingPanels = () => {
  const frame = useCurrentFrame();
  const panelsFade = interpolate(frame, [0, 36], [0, 1], { extrapolateRight: 'clamp' });
  const fx = (i: number) => Math.sin(frame * 0.015 + i * 1.3) * 5;
  const fy = (i: number) => Math.cos(frame * 0.018 + i * 0.9) * 7;

  return (
    <>
      {/* Panel 1: Problem card — top left */}
      <div
        style={{
          position: 'absolute',
          left: '6%',
          top: '11%',
          opacity: panelsFade * 0.22,
          transform: `translate(${fx(0)}px, ${fy(0)}px)`,
          width: 300,
          ...panelCard,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {(['#ff5f57', '#febc2e', '#28c840'] as const).map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
          ))}
          <span
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: FONT,
              marginLeft: 8,
            }}
          >
            Problem
          </span>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: FONT }}>
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
          <div style={{ display: 'flex', gap: 6 }}>
            {(['Array', 'Hash Table'] as const).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  color: '#89b4fa',
                  background: 'rgba(137,180,250,0.1)',
                  border: '1px solid rgba(137,180,250,0.2)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontFamily: FONT,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Panel 2: Session invite — top right */}
      <div
        style={{
          position: 'absolute',
          right: '7%',
          top: '9%',
          opacity: panelsFade * 0.2,
          transform: `translate(${fx(1)}px, ${fy(1)}px)`,
          width: 268,
          ...panelCard,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.35)',
            fontFamily: FONT,
            letterSpacing: '0.9px',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Session Invite
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#fff',
              fontWeight: 700,
              fontFamily: FONT,
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#fff', fontFamily: FONT, fontWeight: 600 }}>
              Alice
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>
              invited you · Two Sum
            </div>
          </div>
        </div>
        <div
          style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8,
            padding: '8px 0',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#a5b4fc',
            fontFamily: FONT,
          }}
        >
          Join Session →
        </div>
      </div>

      {/* Panel 3: AI hint — right side */}
      <div
        style={{
          position: 'absolute',
          right: '5%',
          top: '50%',
          opacity: panelsFade * 0.19,
          transform: `translate(${fx(2)}px, ${fy(2)}px)`,
          width: 254,
          ...panelCard,
          padding: '14px 16px',
          border: '1px solid rgba(139,92,246,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ color: '#cba6f7', fontSize: 11 }}>◆</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#cba6f7', fontFamily: FONT }}>
            SynCode AI
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.55)',
            fontFamily: FONT,
            lineHeight: 1.6,
          }}
        >
          Consider a hash map to achieve O(n) time complexity.
        </div>
      </div>

      {/* Panel 4: Code snippet — left side */}
      <div
        style={{
          position: 'absolute',
          left: '5%',
          top: '50%',
          opacity: panelsFade * 0.19,
          transform: `translate(${fx(3)}px, ${fy(3)}px)`,
          width: 255,
          background: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#181825',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            padding: '8px 14px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
            fontFamily: MONO,
          }}
        >
          solution.ts
        </div>
        <div style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 12, lineHeight: '22px' }}>
          <div>
            <span style={{ color: '#cba6f7' }}>const </span>
            <span style={{ color: '#cdd6f4' }}>map </span>
            <span style={{ color: '#89dceb' }}>= new </span>
            <span style={{ color: '#89b4fa' }}>Map</span>
            <span style={{ color: '#cdd6f4' }}>();</span>
          </div>
          <div>
            <span style={{ color: '#cba6f7' }}>if </span>
            <span style={{ color: '#cdd6f4' }}>(map.</span>
            <span style={{ color: '#89b4fa' }}>has</span>
            <span style={{ color: '#cdd6f4' }}>(comp)) {'{'}</span>
          </div>
          <div>
            <span style={{ color: '#cdd6f4' }}> </span>
            <span style={{ color: '#cba6f7' }}>return </span>
            <span style={{ color: '#cdd6f4' }}>[map.</span>
            <span style={{ color: '#89b4fa' }}>get</span>
            <span style={{ color: '#cdd6f4' }}>(comp), i];</span>
          </div>
        </div>
      </div>

      {/* Panel 5: Stats — bottom left */}
      <div
        style={{
          position: 'absolute',
          left: '8%',
          bottom: '13%',
          opacity: panelsFade * 0.21,
          transform: `translate(${fx(4)}px, ${fy(4)}px)`,
          width: 244,
          ...panelCard,
          padding: '14px 18px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.3)',
            fontFamily: FONT,
            marginBottom: 12,
          }}
        >
          Session Stats
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {(
            [
              { val: '94', label: 'Score', color: '#4ade80' },
              { val: '3/3', label: 'Solved', color: '#89b4fa' },
              { val: '23m', label: 'Duration', color: '#cba6f7' },
            ] as const
          ).map(({ val, label, color }) => (
            <div key={label}>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: FONT }}>{val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: FONT }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel 6: Collaboration chat — bottom right */}
      <div
        style={{
          position: 'absolute',
          right: '6%',
          bottom: '12%',
          opacity: panelsFade * 0.2,
          transform: `translate(${fx(5)}px, ${fy(5)}px)`,
          width: 266,
          ...panelCard,
          padding: '14px 16px',
        }}
      >
        {(
          [
            { initial: 'B', color: '#89b4fa', name: 'Bob', msg: "Let's use a hash map" },
            { initial: 'A', color: '#a6e3a1', name: 'Alice', msg: 'Great thinking! 🎯' },
          ] as const
        ).map(({ initial, color, name, msg }) => (
          <div
            key={name}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 800,
                color: '#1e1e2e',
                fontFamily: FONT,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div>
              <span style={{ fontSize: 11, color, fontFamily: FONT, fontWeight: 700 }}>
                {name}:{' '}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: FONT }}>
                {msg}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
