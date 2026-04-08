import { AnimatePresence, motion } from 'motion/react';

/**
 * Animated error alert for form submission errors.
 */
export function FormErrorAlert({ message }: Readonly<{ message: string | null }>) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
