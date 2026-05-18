import { cn, Switch } from '@syncode/ui';
import { Lock, LockOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface EditorLockToggleProps {
  readonly locked: boolean;
  readonly interactive: boolean;
  readonly disabled?: boolean;
  readonly onLock?: () => void;
  readonly onUnlock?: () => void;
}

export function EditorLockToggle({
  locked,
  interactive,
  disabled = false,
  onLock,
  onUnlock,
}: EditorLockToggleProps) {
  const { t } = useTranslation('rooms');
  const label = locked ? t('hostControl.locked') : t('hostControl.unlocked');
  const Icon = locked ? Lock : LockOpen;

  if (!interactive) {
    return (
      <span
        className={cn(
          'inline-flex min-h-6 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-200',
          locked ? 'text-red-300/80' : 'text-zinc-500/85',
        )}
      >
        <Icon className="size-3 opacity-70" />
        {label}
      </span>
    );
  }

  return (
    <div className="flex min-h-6 items-center gap-2">
      <Switch
        checked={locked}
        disabled={disabled}
        aria-label={t('hostControl.lockToggle')}
        onCheckedChange={(nextChecked) => {
          if (nextChecked && !locked && !disabled) {
            onLock?.();
          }
          if (!nextChecked && locked && !disabled) {
            onUnlock?.();
          }
        }}
        className={cn(
          'group/lock-toggle h-6 w-11 overflow-hidden rounded-full border border-transparent bg-transparent shadow-none transition-colors duration-200',
          disabled && 'opacity-60',
        )}
        thumbPositionClassName="absolute left-px top-1/2 -translate-y-1/2 data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[20px]"
        trackContent={
          <>
            <span
              className={cn(
                'pointer-events-none absolute inset-x-px inset-y-px z-0 rounded-full border transition-colors duration-200',
                locked ? 'border-red-800 bg-red-900' : 'border-zinc-800 bg-zinc-950',
              )}
            />
            <span
              className={cn(
                'pointer-events-none absolute inset-x-px inset-y-px z-0 flex items-center transition-all duration-200',
                locked ? 'justify-start px-1.5' : 'justify-end px-1.5',
              )}
            >
              <Icon
                className={cn(
                  'size-3 transition-colors duration-200',
                  locked ? 'text-stone-100/70' : 'text-zinc-300/60',
                )}
              />
            </span>
          </>
        }
        thumbClassName={cn(
          'z-10 size-5 bg-zinc-500 shadow-none ring-1 ring-black/10 transition-[transform,background-color] duration-200',
        )}
      />
      <span
        className={cn(
          'font-mono text-[10px] font-medium uppercase tracking-[0.16em] transition-colors duration-200',
          locked ? 'text-destructive/85' : 'text-zinc-500/90',
          disabled && 'opacity-60',
        )}
      >
        {label}
      </span>
    </div>
  );
}
