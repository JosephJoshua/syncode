import { Composition, registerRoot } from 'remotion';
import { SynCodeAd } from './compositions/SynCodeAd';

const RemotionRoot = () => {
  return (
    <Composition
      id="SynCodeAd"
      component={SynCodeAd}
      durationInFrames={900} // 24fps × 37.5s
      fps={24}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  );
};

registerRoot(RemotionRoot);
