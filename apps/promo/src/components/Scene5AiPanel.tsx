import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

const AI_CHAT = [
  {
    role: 'ai' as const,
    text: 'Walk me through your approach for Two Sum. What data structure would you use?',
  },
  {
    role: 'alice' as const,
    text: "I'll use a hash map — store each value and look up the complement in O(1).",
  },
  { role: 'ai' as const, text: "Excellent thinking. What's the time complexity of your solution?" },
  { role: 'alice' as const, text: 'O(n) time and O(n) space. We iterate the array once.' },
  {
    role: 'ai' as const,
    text: 'Perfect. How would you handle edge cases — empty array or no valid pair?',
  },
  {
    role: 'bob' as const,
    text: "We should add null validation and return [] as fallback. I'll add that.",
  },
];

const CODE_LINES = [
  'function twoSum(nums, target) {',
  '  const map = new Map();',
  '  for (let i = 0; i < nums.length; i++) {',
  '    const complement = target - nums[i];',
  '    if (map.has(complement)) {',
  '      return [map.get(complement), i];',
  '    }',
  '    map.set(nums[i], i);',
  '  }',
  '  return [];',
  '}',
];

export const Scene5AiPanel = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tiltP = spring({ frame, fps, config: { stiffness: 55, damping: 16 } });
  const rotateX = interpolate(tiltP, [0, 1], [0, 10]);
  const rotateY = interpolate(tiltP, [0, 1], [0, -6]);
  const wScale = interpolate(tiltP, [0, 1], [1, 0.76]);
  const wOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const wDim = interpolate(frame, [55, 95], [1, 0.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        opacity: wOpacity * wDim,
        transform: `translate(-50%, -50%) perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${wScale})`,
        width: 1060,
      }}
    >
      <div
        style={{
          background: '#1e1e2e',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 60px 180px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          height: 380,
        }}
      >
        {/* Chrome */}
        <div
          style={{
            background: '#181825',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '13px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {(['#ff5f57', '#febc2e', '#28c840'] as const).map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
          <span
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.35)',
              fontFamily: FONT,
              marginLeft: 14,
            }}
          >
            AI Interview — Two Sum
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {(
              [
                { l: 'A', c: '#a6e3a1' },
                { l: 'B', c: '#89b4fa' },
              ] as const
            ).map(({ l, c }) => (
              <div
                key={l}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: c,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#1e1e2e',
                  fontFamily: FONT,
                }}
              >
                {l}
              </div>
            ))}
            <span
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.25)',
                fontFamily: FONT,
                marginLeft: 4,
              }}
            >
              2 online
            </span>
          </div>
        </div>

        {/* Body: chat + code */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: AI chat */}
          <div
            style={{
              width: 400,
              borderRight: '1px solid rgba(255,255,255,0.05)',
              padding: '14px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              overflow: 'hidden',
            }}
          >
            {AI_CHAT.map(({ role, text }, i) => {
              const isAi = role === 'ai';
              const color = role === 'alice' ? '#a6e3a1' : role === 'bob' ? '#89b4fa' : '#a5b4fc';
              const label = role === 'ai' ? 'SynCode AI' : role === 'alice' ? 'Alice' : 'Bob';
              const initial = role === 'ai' ? '◆' : role === 'alice' ? 'A' : 'B';
              const bg = isAi ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : color;
              const msgBg = isAi
                ? 'rgba(99,102,241,0.1)'
                : role === 'alice'
                  ? 'rgba(166,227,161,0.08)'
                  : 'rgba(137,180,250,0.08)';
              const msgBorder = isAi
                ? 'rgba(99,102,241,0.2)'
                : role === 'alice'
                  ? 'rgba(166,227,161,0.18)'
                  : 'rgba(137,180,250,0.18)';
              const msgP = interpolate(Math.max(0, frame - i * 6), [0, 10], [0, 1], {
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={text.slice(0, 24)}
                  style={{
                    display: 'flex',
                    gap: 7,
                    alignItems: 'flex-start',
                    justifyContent: isAi ? 'flex-start' : 'flex-end',
                    opacity: msgP,
                  }}
                >
                  {isAi && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        color: '#fff',
                        fontWeight: 800,
                        fontFamily: FONT,
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                  )}
                  <div
                    style={{
                      background: msgBg,
                      border: `1px solid ${msgBorder}`,
                      borderRadius: isAi ? '0 9px 9px 9px' : '9px 0 9px 9px',
                      padding: '7px 10px',
                      maxWidth: 280,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color,
                        fontFamily: FONT,
                        marginBottom: 3,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.6)',
                        fontFamily: FONT,
                        lineHeight: 1.5,
                      }}
                    >
                      {text}
                    </div>
                  </div>
                  {!isAi && (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#1e1e2e',
                        fontFamily: FONT,
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: code */}
          <div
            style={{
              flex: 1,
              padding: '14px 0',
              fontFamily: MONO,
              fontSize: 13,
              lineHeight: '26px',
            }}
          >
            {CODE_LINES.map((text, i) => (
              <div key={text} style={{ display: 'flex', gap: 20, paddingLeft: 16, opacity: 0.38 }}>
                <span style={{ minWidth: 24, textAlign: 'right', color: '#313244', fontSize: 12 }}>
                  {i + 1}
                </span>
                <span style={{ color: '#45475a' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
