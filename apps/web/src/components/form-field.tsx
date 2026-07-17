import { Input, Label } from '@syncode/ui';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface AnimatedFormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly registration: UseFormRegisterReturn;
  readonly staggerDelay?: number;
}

export function AnimatedFormField({
  id,
  label,
  icon: Icon,
  type = 'text',
  autoComplete,
  placeholder,
  error,
  registration,
  staggerDelay = 0,
}: AnimatedFormFieldProps) {
  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: staggerDelay }}
    >
      <Label htmlFor={id} className="text-sm text-white/60">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-11 rounded-xl border-0 bg-white/[0.06] pl-10 text-sm placeholder:text-white/20 focus-visible:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-primary/40"
          aria-invalid={error ? 'true' : 'false'}
          {...registration}
        />
      </div>
      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-sm text-coral"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
