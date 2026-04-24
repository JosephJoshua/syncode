import { useEffect, useRef } from 'react';

export function useVideoTrack(track: MediaStreamTrack | null) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [track]);

  return videoRef;
}
