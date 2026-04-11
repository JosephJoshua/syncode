import type { RoomStatus } from '@syncode/shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ROOM_STATUS_KEYS, STAGE_THEME } from '@/lib/room-stage.js';

interface StageTransitionOverlayProps {
  status: RoomStatus;
}

export function StageTransitionOverlay({ status }: StageTransitionOverlayProps) {
  const { t } = useTranslation('rooms');
  const [visible, setVisible] = useState(false);
  const prevStatusRef = useRef(status);
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      prevStatusRef.current = status;
      return;
    }

    if (status !== prevStatusRef.current && status !== 'waiting') {
      prevStatusRef.current = status;
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(timer);
    }

    prevStatusRef.current = status;
  }, [status]);

  const theme = STAGE_THEME[status];

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
          <div className="pointer-events-none absolute inset-0 dot-grid opacity-[0.06]" />
          <div className="pointer-events-none absolute inset-0 scan-lines" />

          <motion.div
            className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: `radial-gradient(circle, ${theme.glow}, transparent 60%)`,
            }}
          />

          <motion.div
            className="relative text-center"
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.h1
              className={`font-sans text-5xl font-bold tracking-tight sm:text-7xl ${theme.text}`}
              style={{ textShadow: `0 0 60px ${theme.glow}` }}
              initial={{ letterSpacing: '0.1em' }}
              animate={{ letterSpacing: '-0.02em' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {t(ROOM_STATUS_KEYS[status])}
            </motion.h1>
            <motion.p
              className="mt-4 font-mono text-sm tracking-[0.3em] text-primary/60"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              {t(`stage.${status}`)}
            </motion.p>

            <motion.div
              className="mx-auto mt-6 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
