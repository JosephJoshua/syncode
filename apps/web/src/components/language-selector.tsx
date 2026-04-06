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
            badgeText={selectedOption.fallbackIconText}
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
  badgeText,
  label,
  mutedBadge = false,
}: {
  badgeText: string;
  label: string;
  mutedBadge?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <LanguageBadge text={badgeText} muted={mutedBadge} />
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
    </span>
  );
}

function LanguageBadge({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-7 min-w-10 shrink-0 items-center justify-center rounded-xl border px-2.5 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase transition-colors',
        muted
          ? 'border-border/70 bg-muted/70 text-muted-foreground'
          : 'border-primary/20 bg-primary/10 text-primary',
      )}
    >
      {text}
    </span>
  );
}

export function getLanguageSelectorLabel(language: SupportedLanguage) {
  return getLanguageSelectorOption(language).label;
}
