import { AbsoluteFill, interpolate, useCurrentFrame, Video } from 'remotion';
import uiSrc from '../assets/UI_introduction.mp4';

const PILLS = ['Real-time collab', 'AI interviewer', 'Code execution', 'Session replay'];

export const Outro = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [0, 30], [0.94, 1], { extrapolateRight: 'clamp' });
  const taglineOpacity = interpolate(frame, [40, 70], [0, 1], { extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [40, 70], [16, 0], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [80, 110], [0, 1], { extrapolateRight: 'clamp' });
  const ctaY = interpolate(frame, [80, 110], [16, 0], { extrapolateRight: 'clamp' });
  const pillsOpacity = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#000', opacity }}>
      {/* Dimmed UI video background */}
      <Video
        src={uiSrc}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2 }}
        startFrom={0}
        volume={0}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'SF Pro Display, -apple-system, sans-serif',
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            transform: `scale(${scale})`,
            fontSize: 88,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-2px',
            lineHeight: 1,
          }}
        >
          SynCode
        </div>

        {/* Tagline */}
        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            fontSize: 26,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.55)',
            marginTop: 20,
            letterSpacing: '0.2px',
          }}
        >
          Practice interviews. Together.
        </div>

        {/* Feature pills */}
        <div
          style={{
            opacity: pillsOpacity,
            display: 'flex',
            gap: 12,
            marginTop: 40,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {PILLS.map((pill) => (
            <div
              key={pill}
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 100,
                padding: '6px 18px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                fontWeight: 500,
                letterSpacing: '0.3px',
              }}
            >
              {pill}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            marginTop: 52,
            background: '#fff',
            color: '#000',
            fontSize: 16,
            fontWeight: 600,
            padding: '14px 36px',
            borderRadius: 100,
            letterSpacing: '0.2px',
          }}
        >
          Start a session
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
