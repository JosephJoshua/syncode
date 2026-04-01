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
  fieldClassName?: string;
  labelClassName?: string;
  inputWrapperClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
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
  fieldClassName,
  labelClassName,
  inputWrapperClassName,
  inputClassName,
  iconClassName,
}: AnimatedFormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <motion.div
      className={['space-y-1.5', fieldClassName].filter(Boolean).join(' ')}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: staggerDelay }}
    >
      <Label
        htmlFor={id}
        className={['text-sm font-medium text-foreground/92', labelClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </Label>
      <div
        className={['input-glow relative rounded-lg transition-shadow', inputWrapperClassName]
          .filter(Boolean)
          .join(' ')}
      >
        <Icon
          className={[
            'pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors',
            iconClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        />
        <Input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={['pl-10', inputClassName].filter(Boolean).join(' ')}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
          {...registration}
        />
      </div>
      <AnimatePresence>
        {error ? (
          <motion.p
            id={errorId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden text-xs leading-5 text-destructive/95"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
