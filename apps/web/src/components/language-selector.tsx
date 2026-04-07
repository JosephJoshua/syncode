import type { SupportedLanguage } from '@syncode/shared';
import { cn, Select, SelectContent, SelectItem, SelectTrigger } from '@syncode/ui';
import { getLanguageSelectorOption, getLanguageSelectorOptions } from './language-selector.data';

const DEFAULT_PLACEHOLDER = 'Select language';
const EMPTY_PLACEHOLDER = 'No languages available';

export interface LanguageSelectorProps {
  value?: SupportedLanguage;
  onValueChange: (value: SupportedLanguage) => void;
  languages?: readonly SupportedLanguage[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function LanguageSelector({
  value,
  onValueChange,
  languages,
  disabled = false,
  placeholder = DEFAULT_PLACEHOLDER,
  className,
}: LanguageSelectorProps) {
  const options = getLanguageSelectorOptions(languages);
  const selectedOption = value ? (options.find((option) => option.value === value) ?? null) : null;
  const isEmpty = options.length === 0;
  const isDisabled = disabled || isEmpty;
  const triggerLabel = isEmpty ? EMPTY_PLACEHOLDER : placeholder;

  return (
    <Select
      value={selectedOption?.value}
      onValueChange={(nextValue) => onValueChange(nextValue as SupportedLanguage)}
      disabled={isDisabled}
    >
      <SelectTrigger
        className={cn('min-w-0', className)}
        aria-label="Programming language"
        data-empty={isEmpty ? 'true' : undefined}
      >
        {selectedOption ? (
          <LanguageSelectorValue
            iconSrc={selectedOption.iconSrc}
            badgeText={selectedOption.fallbackIconText}
            language={selectedOption.value}
            label={selectedOption.label}
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
          >
            <LanguageSelectorValue
              iconSrc={option.iconSrc}
              badgeText={option.fallbackIconText}
              language={option.value}
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
  badgeText,
  language,
  label,
  mutedBadge = false,
}: {
  iconSrc: string;
  badgeText: string;
  language: SupportedLanguage;
  label: string;
  mutedBadge?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LanguageIcon
        iconSrc={iconSrc}
        fallbackText={badgeText}
        language={language}
        muted={mutedBadge}
      />
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
    </span>
  );
}

function LanguageIcon({
  iconSrc,
  fallbackText,
  language,
  muted = false,
}: {
  iconSrc: string;
  fallbackText: string;
  language: SupportedLanguage;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md border p-1 transition-colors',
        muted
          ? 'border-border/70 bg-white/88 shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]'
          : 'border-primary/20 bg-white/96 shadow-[inset_0_1px_0_rgb(255_255_255/0.36)]',
      )}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className={cn(
            'block h-4 w-4 object-contain',
            language === 'c' && 'h-3 w-3',
            language === 'cpp' && 'h-4.5 w-4.5',
            language === 'rust' && 'h-4.5 w-4.5',
            language === 'go' && 'h-4.5 w-4.5',
          )}
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

export function getLanguageSelectorLabel(language: SupportedLanguage) {
  return getLanguageSelectorOption(language).label;
}
