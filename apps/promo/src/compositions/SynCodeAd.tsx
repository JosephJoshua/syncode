import { AbsoluteFill, Audio, interpolate, Sequence, useCurrentFrame } from 'remotion';
import musicSrc from '../assets/Click-CV Echo.mp3';
import { Scene1Hook } from '../components/Scene1Hook';
import { Scene2Solution } from '../components/Scene2Solution';
import { Scene3Transition } from '../components/Scene3Transition';
import { Scene4Walkthrough } from '../components/Scene4Walkthrough';
import { Scene5Outro } from '../components/Scene5Outro';

// 24fps · 37.5s = 900 frames
// Scene 1 (Hook):        0   – 108  (4.5s)
// Scene 2 (Solution):    108 – 240  (5.5s)
// Scene 3 (Transition):  240 – 432  (8s)
// Scene 4 (Walkthrough): 432 – 684  (10.5s)
// Scene 5 (Outro):       684 – 900  (9s)

export const SynCodeAd = () => {
  const frame = useCurrentFrame();
  const musicVolume = interpolate(frame, [840, 900], [0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Audio src={musicSrc} volume={musicVolume} />

      <Sequence from={0} durationInFrames={108}>
        <Scene1Hook />
      </Sequence>

      <Sequence from={108} durationInFrames={132}>
        <Scene2Solution />
      </Sequence>

      <Sequence from={240} durationInFrames={192}>
        <Scene3Transition />
      </Sequence>

      <Sequence from={432} durationInFrames={252}>
        <Scene4Walkthrough />
      </Sequence>

      <Sequence from={684} durationInFrames={216}>
        <Scene5Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
