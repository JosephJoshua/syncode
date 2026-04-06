import { useCallback, useRef, useState } from 'react';

export function useClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      } catch {
        // Clipboard API not available
      }
    },
    [resetMs],
  );

  return { copied, copy } as const;
}
