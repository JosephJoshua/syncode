import { Input, Label } from '@syncode/ui';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface AnimatedFormFieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  staggerDelay?: number;
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
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: staggerDelay }}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="input-glow relative rounded-lg transition-shadow">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors" />
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pl-10"
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
            className="overflow-hidden text-sm text-destructive"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
