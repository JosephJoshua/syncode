import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene4ProblemPanel } from './Scene4ProblemPanel';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

const CODE: Array<{ tokens: Array<{ text: string; color: string }>; author: 'alice' | 'bob' }> = [
  {
    author: 'alice',
    tokens: [
      { text: 'function ', color: '#cba6f7' },
      { text: 'twoSum', color: '#89b4fa' },
      { text: '(', color: '#cdd6f4' },
      { text: 'nums', color: '#fab387' },
      { text: ': ', color: '#cdd6f4' },
      { text: 'number', color: '#89dceb' },
      { text: '[], ', color: '#cdd6f4' },
      { text: 'target', color: '#fab387' },
      { text: ': ', color: '#cdd6f4' },
      { text: 'number', color: '#89dceb' },
      { text: '): ', color: '#cdd6f4' },
      { text: 'number', color: '#89dceb' },
      { text: '[] {', color: '#cdd6f4' },
    ],
  },
  {
    author: 'alice',
    tokens: [
      { text: '  ', color: '' },
      { text: 'const ', color: '#cba6f7' },
      { text: 'map ', color: '#cdd6f4' },
      { text: '= new ', color: '#89dceb' },
      { text: 'Map', color: '#89b4fa' },
      { text: '<', color: '#cdd6f4' },
      { text: 'number', color: '#89dceb' },
      { text: ', ', color: '#cdd6f4' },
      { text: 'number', color: '#89dceb' },
      { text: '>();', color: '#cdd6f4' },
    ],
  },
  { author: 'alice', tokens: [{ text: '', color: '' }] },
  {
    author: 'alice',
    tokens: [
      { text: '  ', color: '' },
      { text: 'for ', color: '#cba6f7' },
      { text: '(', color: '#cdd6f4' },
      { text: 'let ', color: '#cba6f7' },
      { text: 'i ', color: '#cdd6f4' },
      { text: '= ', color: '#89dceb' },
      { text: '0', color: '#fab387' },
      { text: '; i < nums.length; i++) {', color: '#cdd6f4' },
    ],
  },
  {
    author: 'alice',
    tokens: [
      { text: '    ', color: '' },
      { text: 'const ', color: '#cba6f7' },
      { text: 'complement ', color: '#cdd6f4' },
      { text: '= target ', color: '#89dceb' },
      { text: '- ', color: '#f38ba8' },
      { text: 'nums[i];', color: '#cdd6f4' },
    ],
  },
  {
    author: 'alice',
    tokens: [
      { text: '    ', color: '' },
      { text: 'if ', color: '#cba6f7' },
      { text: '(map.', color: '#cdd6f4' },
      { text: 'has', color: '#89b4fa' },
      { text: '(complement)) {', color: '#cdd6f4' },
    ],
  },
  {
    author: 'bob',
    tokens: [
      { text: '      ', color: '' },
      { text: 'return ', color: '#cba6f7' },
      { text: '[map.', color: '#cdd6f4' },
      { text: 'get', color: '#89b4fa' },
      { text: '(complement)', color: '#cdd6f4' },
      { text: '!', color: '#f38ba8' },
      { text: ', i];', color: '#cdd6f4' },
    ],
  },
  { author: 'bob', tokens: [{ text: '    }', color: '#cdd6f4' }] },
  {
    author: 'bob',
    tokens: [
      { text: '    map.', color: '#cdd6f4' },
      { text: 'set', color: '#89b4fa' },
      { text: '(nums[i], i);', color: '#cdd6f4' },
    ],
  },
  { author: 'bob', tokens: [{ text: '  }', color: '#cdd6f4' }] },
  { author: 'bob', tokens: [{ text: '', color: '' }] },
  {
    author: 'bob',
    tokens: [
      { text: '  ', color: '' },
      { text: 'return ', color: '#cba6f7' },
      { text: '[];', color: '#cdd6f4' },
    ],
  },
  { author: 'bob', tokens: [{ text: '}', color: '#cdd6f4' }] },
];

const Cursor = ({ color, label }: { color: string; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
    <span
      style={{
        width: 2,
        height: 18,
        background: color,
        borderRadius: 1,
        display: 'inline-block',
        boxShadow: `0 0 6px ${color}`,
      }}
    />
    <span
      style={{
        background: color,
        color: '#1e1e2e',
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  </span>
);

export const Scene4Walkthrough = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const SPLIT = 72;

  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  const ideP = spring({
    frame: Math.max(0, frame - SPLIT),
    fps,
    config: { stiffness: 140, damping: 20 },
  });
  const ideOpacity = interpolate(ideP, [0, 0.4], [0, 1]);
  const ideY = interpolate(ideP, [0, 1], [44, 0]);

  const lineOpacity = (lineIdx: number) =>
    interpolate(Math.max(0, frame - SPLIT - lineIdx * 9), [0, 7], [0, 1], {
      extrapolateRight: 'clamp',
    });

  const aliceLine = Math.min(
    Math.floor(
      interpolate(frame - SPLIT, [5, 58], [0, 5], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
    5,
  );
  const bobLine = Math.min(
    Math.floor(
      interpolate(frame - SPLIT, [50, 118], [6, 12], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
    12,
  );
  const aliceCursorOpacity = interpolate(frame - SPLIT, [10, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bobCursorOpacity = interpolate(frame - SPLIT, [44, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const activeLine = bobCursorOpacity > 0.5 ? bobLine : aliceLine;

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 75% 65% at 50% 45%, #080d1a 0%, #050710 55%, #000 100%)',
        overflow: 'hidden',
        opacity: enter * exit,
      }}
    >
      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(137,180,250,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(137,180,250,0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          width: 900,
          height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Scene4ProblemPanel />

      {/* IDE */}
      {frame >= SPLIT - 12 && (
        <div
          style={{
            position: 'absolute',
            opacity: ideOpacity,
            transform: `translate(-50%, calc(-50% + ${ideY}px))`,
            width: 1060,
            top: '50%',
            left: '50%',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #1e1e2e 0%, #1a1826 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 48px 130px rgba(0,0,0,0.7), 0 0 80px rgba(99,102,241,0.06)',
            }}
          >
            {/* Tab bar */}
            <div
              style={{
                background: '#181825',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 0,
              }}
            >
              {(['#ff5f57', '#febc2e', '#28c840'] as const).map((c) => (
                <div
                  key={c}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: c,
                    marginRight: 6,
                  }}
                />
              ))}
              <div style={{ marginLeft: 18, display: 'flex' }}>
                {(
                  [
                    { name: 'solution.ts', active: true },
                    { name: 'tests.ts', active: false },
                  ] as const
                ).map(({ name, active }) => (
                  <div
                    key={name}
                    style={{
                      padding: '11px 20px',
                      fontSize: 13,
                      fontFamily: MONO,
                      color: active ? '#cdd6f4' : 'rgba(255,255,255,0.25)',
                      borderBottom: active ? '2px solid #89b4fa' : '2px solid transparent',
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  opacity: aliceCursorOpacity,
                }}
              >
                {(
                  [
                    { label: 'Alice', color: '#a6e3a1' },
                    { label: 'Bob', color: '#89b4fa' },
                  ] as const
                ).map(({ label, color }) => (
                  <div
                    key={label}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#1e1e2e',
                      fontFamily: FONT,
                      boxShadow: `0 0 10px ${color}60`,
                    }}
                  >
                    {label[0]}
                  </div>
                ))}
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.25)',
                    fontFamily: FONT,
                    marginLeft: 4,
                    paddingRight: 4,
                  }}
                >
                  2 online
                </div>
              </div>
            </div>

            {/* Code — lines reveal one at a time */}
            <div style={{ padding: '22px 0', fontFamily: MONO, fontSize: 15, lineHeight: '28px' }}>
              {CODE.map((line, i) => (
                <div
                  key={`line-${i}-${line.tokens[0]?.text ?? ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: i === activeLine ? 'rgba(137,180,250,0.07)' : 'transparent',
                    borderLeft:
                      i === activeLine
                        ? '2px solid rgba(137,180,250,0.5)'
                        : '2px solid transparent',
                    opacity: lineOpacity(i),
                  }}
                >
                  <span
                    style={{
                      minWidth: 56,
                      textAlign: 'right',
                      paddingRight: 24,
                      color: i === activeLine ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                      fontSize: 13,
                      userSelect: 'none',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    {line.tokens.map((t, j) => (
                      <span
                        key={`${t.text}-${t.color}-${j}`}
                        style={{ color: t.color || 'transparent' }}
                      >
                        {t.text}
                      </span>
                    ))}
                  </span>
                  {i === aliceLine && (
                    <span style={{ opacity: aliceCursorOpacity, marginLeft: 2 }}>
                      <Cursor color="#a6e3a1" label="Alice" />
                    </span>
                  )}
                  {i === bobLine && bobLine !== aliceLine && (
                    <span style={{ opacity: bobCursorOpacity, marginLeft: 2 }}>
                      <Cursor color="#89b4fa" label="Bob" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Status bar */}
            <div
              style={{
                background: '#181825',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                padding: '8px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {(
                [
                  { label: 'TypeScript', color: '#89b4fa' },
                  { label: 'UTF-8', color: 'rgba(255,255,255,0.25)' },
                  { label: 'LF', color: 'rgba(255,255,255,0.25)' },
                ] as const
              ).map(({ label, color }) => (
                <span key={label} style={{ fontSize: 12, color, fontFamily: MONO }}>
                  {label}
                </span>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4ade80',
                    boxShadow: '0 0 6px #4ade80',
                  }}
                />
                <span style={{ fontSize: 12, color: '#4ade80', fontFamily: MONO }}>synced</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
