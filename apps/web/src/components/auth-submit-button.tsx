import { Button } from '@syncode/ui';
import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

/**
 * Animated submit button with three visual states: idle, loading, and success.
 * Used by both login and register forms.
 */
export function AuthSubmitButton({
  isPending,
  isSuccess,
  idleLabel,
  pendingLabel,
  successLabel,
  disabled,
  staggerDelay = 0,
}: Readonly<{
  isPending: boolean;
  isSuccess: boolean;
  idleLabel: string;
  pendingLabel: string;
  successLabel: string;
  disabled?: boolean;
  staggerDelay?: number;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: staggerDelay }}
    >
      <Button
        type="submit"
        disabled={disabled ?? (isPending || isSuccess)}
        className="shimmer-sweep w-full"
        size="lg"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isSuccess ? (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2"
            >
              <Check className="size-4" />
              {successLabel}
            </motion.span>
          ) : isPending ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {pendingLabel}
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2"
            >
              {idleLabel}
              <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
