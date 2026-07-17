import { ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';

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
  const isDisabled = disabled ?? (isPending || isSuccess);
  const label = isSuccess ? successLabel : isPending ? pendingLabel : idleLabel;
  const showHover = !isPending && !isSuccess;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: staggerDelay }}
    >
      <button
        type="submit"
        disabled={isDisabled}
        className="group relative w-full overflow-hidden rounded-full bg-white px-8 py-4 text-base font-semibold text-ink transition-shadow hover:shadow-lg-flat disabled:cursor-not-allowed disabled:opacity-60"
      >
        {showHover ? (
          <span className="btn-text-holder">
            <span className="btn-text-main flex items-center justify-center gap-2">
              {label}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
            </span>
            <span
              className="btn-text-hover flex items-center justify-center gap-2"
              aria-hidden="true"
            >
              {label}
              <ArrowRight className="size-5" />
            </span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {isPending ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <Check className="size-5" />
            )}
            {label}
          </span>
        )}
      </button>
    </motion.div>
  );
}
