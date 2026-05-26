import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FONT = 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif';
const MONO = '"SF Mono", "Fira Code", monospace';

const STATS_LEFT = [
  { label: 'LANGUAGE', value: 'TypeScript', color: '#cdd6f4' },
  { label: 'DIFFICULTY', value: 'Easy', color: '#4ade80' },
  { label: 'DURATION', value: '23m 41s', color: '#cdd6f4' },
  { label: 'SCORE', value: '94 / 100', color: '#4ade80' },
];

const PARTICIPANTS = [
  { initial: 'A', name: 'Alice', role: 'Interviewer', color: '#a6e3a1' },
  { initial: 'B', name: 'Bob', role: 'Candidate', color: '#89b4fa' },
];

const METRICS = [
  { label: 'Code Quality', disp: '94', unit: '/ 100', color: '#4ade80', barWidth: 94 },
  { label: 'Time Complexity', disp: 'O(n)', unit: '✓ Optimal', color: '#89b4fa', barWidth: 100 },
  { label: 'Communication', disp: 'Excellent', unit: '5 / 5', color: '#cba6f7', barWidth: 95 },
  { label: 'Problems Solved', disp: '3 / 3', unit: '100%', color: '#fab387', barWidth: 100 },
];

const CODE_ANALYSIS = [
  {
    text: 'Hash map: O(n) time and O(n) space — optimal solution.',
    color: 'rgba(255,255,255,0.55)',
  },
  { text: '✓  Correct use of Map.has() and Map.get() for complement lookup', color: '#4ade80' },
  {
    text: '✓  Clean variable naming: complement, map, nums are self-documenting',
    color: '#4ade80',
  },
  { text: '⚠  Missing null guard — consider adding an early return check', color: '#fab387' },
];

export const Scene5Report = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reportP = spring({
    frame: Math.max(0, frame - 68),
    fps,
    config: { stiffness: 120, damping: 17 },
  });
  const reportScale = interpolate(reportP, [0, 1], [0.84, 1]);
  const reportOpacity = interpolate(reportP, [0, 0.35], [0, 1]);
  const reportY = interpolate(reportP, [0, 1], [28, 0]);

  const modeSwitchP = interpolate(frame, [155, 168], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const analysisP = spring({
    frame: Math.max(0, frame - 140),
    fps,
    config: { stiffness: 100, damping: 18 },
  });
  const analysisOpacity = interpolate(analysisP, [0, 0.5], [0, 1]);
  const analysisY = interpolate(analysisP, [0, 1], [14, 0]);

  const tagP = spring({
    frame: Math.max(0, frame - 172),
    fps,
    config: { stiffness: 115, damping: 20 },
  });
  const tagOpacity = interpolate(tagP, [0, 0.5], [0, 1]);
  const tagY = interpolate(tagP, [0, 1], [16, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, calc(-50% + ${reportY}px)) scale(${reportScale})`,
        opacity: reportOpacity,
        width: 960,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: 'rgba(8,6,18,0.96)',
          backdropFilter: 'blur(56px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 28,
          padding: '32px 44px',
          boxShadow:
            '0 56px 160px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 80px rgba(139,92,246,0.08) inset',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(74,222,128,0.8)',
              fontFamily: MONO,
              letterSpacing: '1.6px',
              textTransform: 'uppercase',
            }}
          >
            Session Report
          </div>
          <div
            style={{
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 100,
              padding: '5px 13px',
              fontSize: 11,
              fontWeight: 700,
              color: '#4ade80',
              fontFamily: FONT,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 6px #4ade80',
              }}
            />
            Passed
          </div>
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#fff',
            fontFamily: FONT,
            letterSpacing: '-0.5px',
            marginTop: 6,
            marginBottom: 3,
          }}
        >
          Two Sum
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.28)',
            fontFamily: FONT,
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>26 May 2026, 00:02</span>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'inline-block',
            }}
          />
          <span>23m 41s</span>
          <span
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'inline-block',
            }}
          />
          <span>Alice &amp; Bob</span>
        </div>

        {/* Stats + participants */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
          <div
            style={{
              flex: '1 1 0',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 9,
            }}
          >
            {/* MODE cell */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 11,
                padding: '10px 13px',
                opacity: interpolate(Math.max(0, frame - 76), [0, 14], [0, 1], {
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.28)',
                  fontFamily: MONO,
                  letterSpacing: '1.1px',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                MODE
              </div>
              <div style={{ position: 'relative', height: 20 }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#a5b4fc',
                    fontFamily: FONT,
                    opacity: 1 - modeSwitchP,
                    whiteSpace: 'nowrap',
                  }}
                >
                  AI Interview
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#cba6f7',
                    fontFamily: FONT,
                    opacity: modeSwitchP,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Peer Interview
                </div>
              </div>
            </div>
            {STATS_LEFT.map(({ label, value, color }, i) => {
              const p = interpolate(Math.max(0, frame - 82 - i * 7), [0, 14], [0, 1], {
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={label}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 11,
                    padding: '10px 13px',
                    opacity: p,
                    transform: `translateY(${interpolate(p, [0, 1], [6, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.28)',
                      fontFamily: MONO,
                      letterSpacing: '1.1px',
                      textTransform: 'uppercase',
                      marginBottom: 5,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color, fontFamily: FONT }}>
                    {value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Participants */}
          <div style={{ width: 210, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.28)',
                fontFamily: MONO,
                letterSpacing: '1.1px',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              Participants
            </div>
            {PARTICIPANTS.map(({ initial, name, role, color }, i) => {
              const p = interpolate(Math.max(0, frame - 88 - i * 10), [0, 14], [0, 1], {
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={name}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 11,
                    padding: '11px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    opacity: p,
                    transform: `translateX(${interpolate(p, [0, 1], [8, 0])}px)`,
                  }}
                >
                  <div
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
                      flexShrink: 0,
                    }}
                  >
                    {initial}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: FONT }}>
                      {name}
                    </div>
                    <div
                      style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}
                    >
                      {role}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 22 }}>
          {METRICS.map(({ label, disp, unit, color, barWidth }, idx) => {
            const barP = spring({
              frame: Math.max(0, frame - 96 - idx * 12),
              fps,
              config: { stiffness: 75, damping: 18 },
            });
            const barW = interpolate(barP, [0, 1], [0, barWidth]);
            const mOpacity = interpolate(Math.max(0, frame - 90 - idx * 10), [0, 16], [0, 1], {
              extrapolateRight: 'clamp',
            });
            return (
              <div key={label} style={{ opacity: mOpacity }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontFamily: FONT }}>
                    {label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    <span
                      style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: FONT }}
                    >
                      {disp}
                    </span>
                    <span style={{ fontSize: 11, color, fontFamily: FONT, fontWeight: 600 }}>
                      {unit}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    height: 4,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${barW}%`,
                      background: `linear-gradient(90deg, ${color}99, ${color})`,
                      borderRadius: 2,
                      boxShadow: `0 0 8px ${color}60`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            opacity: analysisOpacity,
            transform: `translateY(${analysisY}px)`,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.28)',
              fontFamily: MONO,
              letterSpacing: '1.1px',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Code Analysis
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {CODE_ANALYSIS.map(({ text, color }, i) => {
              const lp = interpolate(Math.max(0, frame - 148 - i * 8), [0, 12], [0, 1], {
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={text.slice(0, 24)}
                  style={{ fontSize: 12, color, fontFamily: FONT, lineHeight: 1.55, opacity: lp }}
                >
                  {text}
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{ opacity: tagOpacity, transform: `translateY(${tagY}px)`, textAlign: 'center' }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              fontFamily: FONT,
              letterSpacing: '-0.6px',
              lineHeight: 1.15,
              background: 'linear-gradient(135deg, #fff 0%, #e0d7ff 50%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            You get everything.
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: FONT,
              marginTop: 7,
            }}
          >
            Deep insights after every session.
          </div>
        </div>
      </div>
    </div>
  );
};
