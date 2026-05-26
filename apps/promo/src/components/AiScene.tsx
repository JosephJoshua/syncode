import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Video } from 'remotion';
import sessionSrc from '../assets/session_workflow_and_ai_report.mp4';

export const AiScene = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });
  const labelOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const labelExitOpacity = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames - 10],
    [1, 0],
    { extrapolateLeft: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ background: '#000', opacity: opacity * exitOpacity }}>
      <Video
        src={sessionSrc}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        startFrom={0}
        volume={0}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: 80,
          opacity: labelOpacity * labelExitOpacity,
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)',
            borderRadius: 100,
            padding: '10px 28px',
            fontSize: 18,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.9)',
            letterSpacing: '0.3px',
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
          }}
        >
          AI-powered feedback
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
