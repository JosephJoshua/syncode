import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Video } from 'remotion';
import uiSrc from '../assets/UI_introduction.mp4';

export const Intro = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });
  const textOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' });
  const scale = interpolate(frame, [20, 50], [0.92, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#000', opacity: opacity * exitOpacity }}>
      {/* Dimmed UI video as background */}
      <Video
        src={uiSrc}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
        startFrom={0}
        volume={0}
      />

      {/* Wordmark overlay */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: textOpacity,
        }}
      >
        <div style={{ transform: `scale(${scale})`, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-2px',
              lineHeight: 1,
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            }}
          >
            SynCode
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 16,
              letterSpacing: '0.5px',
              fontFamily: 'SF Pro Display, -apple-system, sans-serif',
            }}
          >
            Interview together.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
