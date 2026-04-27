import type { SupportedLanguage } from '@syncode/shared';
import { cn, Select, SelectContent, SelectItem, SelectTrigger } from '@syncode/ui';
import { getLanguageSelectorOptions } from './language-selector.data.js';

export interface LanguageSelectorProps {
  value?: SupportedLanguage;
  onValueChange: (value: SupportedLanguage) => void;
  languages?: readonly SupportedLanguage[];
  labelOverrides?: Partial<Record<SupportedLanguage, string>>;
  disabled?: boolean;
  placeholder?: string;
  emptyPlaceholder?: string;
  className?: string;
  ariaLabel?: string;
}

export function LanguageSelector({
  value,
  onValueChange,
  languages,
  labelOverrides,
  disabled = false,
  placeholder,
  emptyPlaceholder,
  className,
  ariaLabel = 'Programming language',
}: LanguageSelectorProps) {
  const options = getLanguageSelectorOptions(languages).map((option) => ({
    ...option,
    label: labelOverrides?.[option.value] ?? option.label,
  }));
  const selectedOption = value ? (options.find((option) => option.value === value) ?? null) : null;
  const isEmpty = options.length === 0;
  const isDisabled = disabled || isEmpty;
  const triggerLabel = isEmpty ? emptyPlaceholder : placeholder;

  return (
    <Select
      value={selectedOption?.value ?? ''}
      onValueChange={(nextValue) => onValueChange(nextValue as SupportedLanguage)}
      disabled={isDisabled}
    >
      <SelectTrigger
        className={cn('min-w-0', className)}
        aria-label={ariaLabel}
        data-empty={isEmpty ? 'true' : undefined}
      >
        {selectedOption ? (
          <LanguageSelectorValue
            iconSrc={selectedOption.iconSrc}
            iconClassName={selectedOption.iconClassName}
            badgeText={selectedOption.fallbackIconText}
            label={selectedOption.label}
            compact
          />
        ) : (
          <span className="truncate text-sm text-muted-foreground">{triggerLabel}</span>
        )}
      </SelectTrigger>

      <SelectContent align="start" sideOffset={8}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            textValue={option.label}
            hideIndicator
          >
            <LanguageSelectorValue
              iconSrc={option.iconSrc}
              iconClassName={option.iconClassName}
              badgeText={option.fallbackIconText}
              label={option.label}
              mutedBadge={option.value !== selectedOption?.value}
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LanguageSelectorValue({
  iconSrc,
  iconClassName,
  badgeText,
  label,
  mutedBadge = false,
  compact = false,
}: {
  iconSrc: string;
  iconClassName?: string;
  badgeText: string;
  label: string;
  mutedBadge?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LanguageIcon
        iconSrc={iconSrc}
        iconClassName={iconClassName}
        fallbackText={badgeText}
        muted={mutedBadge}
        compact={compact}
      />
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
    </span>
  );
}

function LanguageIcon({
  iconSrc,
  iconClassName,
  fallbackText,
  muted = false,
  compact = false,
}: {
  iconSrc: string;
  iconClassName?: string;
  fallbackText: string;
  muted?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border transition-colors',
        compact ? 'size-5 p-0.5' : 'size-6 p-1',
        muted
          ? 'border-border/70 bg-white/88 shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]'
          : 'border-primary/20 bg-white/96 shadow-[inset_0_1px_0_rgb(255_255_255/0.36)]',
      )}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className={cn('block h-4 w-4 object-contain', iconClassName)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="font-mono text-[11px] font-semibold tracking-[0.16em] uppercase text-slate-900">
          {fallbackText}
        </span>
      )}
    </span>
  );
}
