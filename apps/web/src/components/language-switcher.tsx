import { cn } from '@syncode/ui';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'EN',
  zh: '中文',
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation('common');

  const currentLang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const nextLang = currentLang === 'en' ? 'zh' : 'en';

  const handleToggle = () => {
    void i18n.changeLanguage(nextLang);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={t('switchLanguage', { language: LANGUAGE_LABELS[nextLang] })}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
        'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        className,
      )}
    >
      <Languages className="size-3.5" />
      {LANGUAGE_LABELS[currentLang]}
    </button>
  );
}
