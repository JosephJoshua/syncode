import { useEffect, useState } from 'react';

const SAMPLE_SIZE = 8;

export interface ImageColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Extracts a dominant color from an image URL by downscaling to a tiny
 * canvas and averaging pixel values. Returns RGB components for flexible
 * use in shadows/glows, or null if extraction fails (CORS, load error).
 */
export function useImageDominantColor(src: string | null | undefined): ImageColor | null {
  const [color, setColor] = useState<ImageColor | null>(null);

  useEffect(() => {
    if (!src) {
      setColor(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i] ?? 0;
          const pg = data[i + 1] ?? 0;
          const pb = data[i + 2] ?? 0;
          const brightness = (pr + pg + pb) / 3;
          // Skip near-black and near-white pixels for a more vivid result
          if (brightness > 30 && brightness < 225) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }

        if (count === 0) {
          setColor(null);
          return;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation for a vivid glow
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const mid = (max + min) / 2;
        const boost = 1.4;
        r = Math.min(255, Math.round(mid + (r - mid) * boost));
        g = Math.min(255, Math.round(mid + (g - mid) * boost));
        b = Math.min(255, Math.round(mid + (b - mid) * boost));

        setColor({ r, g, b });
      } catch {
        setColor(null);
      }
    };

    img.onerror = () => setColor(null);
    img.src = src;
  }, [src]);

  return color;
}
