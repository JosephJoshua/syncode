import { interpolate, useCurrentFrame } from 'remotion';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

const SPLIT = 72;

export const Scene4ProblemPanel = () => {
  const frame = useCurrentFrame();

  const problemOpacity = interpolate(frame, [SPLIT - 22, SPLIT], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scrollY = interpolate(frame, [12, SPLIT - 12], [0, -160], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame >= SPLIT + 12) return null;

  return (
    <div
      style={{
        position: 'absolute',
        opacity: problemOpacity,
        width: 920,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.06) inset',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '14px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {(['#ff5f57', '#febc2e', '#28c840'] as const).map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
          <div
            style={{
              marginLeft: 14,
              fontSize: 13,
              color: 'rgba(255,255,255,0.28)',
              fontFamily: FONT,
            }}
          >
            Problem Description
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {(['Arrays', 'Hash Table'] as const).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  color: '#89b4fa',
                  background: 'rgba(137,180,250,0.1)',
                  border: '1px solid rgba(137,180,250,0.2)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontFamily: FONT,
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Scrolling body */}
        <div style={{ overflow: 'hidden', height: 360 }}>
          <div style={{ transform: `translateY(${scrollY}px)`, padding: '28px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: FONT,
                  letterSpacing: '-0.5px',
                }}
              >
                1. Two Sum
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#4ade80',
                  background: 'rgba(74,222,128,0.1)',
                  border: '1px solid rgba(74,222,128,0.25)',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontFamily: FONT,
                }}
              >
                Easy
              </span>
            </div>

            <div
              style={{
                fontSize: 16,
                color: 'rgba(255,255,255,0.6)',
                fontFamily: FONT,
                lineHeight: 1.85,
                marginBottom: 28,
              }}
            >
              Given an array of integers <span style={{ color: '#89b4fa' }}>nums</span> and an
              integer <span style={{ color: '#89b4fa' }}>target</span>, return indices of the two
              numbers such that they add up to target. You may assume exactly one solution exists.
            </div>

            {(
              [
                {
                  label: 'Example 1',
                  input: 'nums = [2,7,11,15], target = 9',
                  output: '[0, 1]',
                },
                { label: 'Example 2', input: 'nums = [3,2,4], target = 6', output: '[1, 2]' },
              ] as const
            ).map(({ label, input, output }) => (
              <div key={label} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.75)',
                    fontFamily: FONT,
                    marginBottom: 8,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    fontFamily: MONO,
                    fontSize: 13,
                    color: '#cdd6f4',
                    lineHeight: 1.8,
                  }}
                >
                  <div>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>Input: </span>
                    {input}
                  </div>
                  <div>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>Output: </span>
                    {output}
                  </div>
                </div>
              </div>
            ))}

            <div
              style={{
                fontFamily: MONO,
                fontSize: 13,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 2.2,
              }}
            >
              <div>2 ≤ nums.length ≤ 10⁴</div>
              <div>−10⁹ ≤ nums[i] ≤ 10⁹</div>
              <div>Only one valid answer exists.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
