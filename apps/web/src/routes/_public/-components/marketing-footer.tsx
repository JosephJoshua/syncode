import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher.js';

interface FooterLinkColumn {
  readonly title: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

export function MarketingFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  const columns: readonly FooterLinkColumn[] = [
    {
      title: t('footer.product'),
      links: [
        { label: t('footer.features'), href: '#features' },
        { label: t('footer.terminalDemo'), href: '#demo' },
      ],
    },
    {
      title: t('footer.community'),
      links: [
        { label: t('footer.github'), href: 'https://github.com/JosephJoshua/syncode' },
        { label: t('footer.discord'), href: '#' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.terms'), href: '#' },
        { label: t('footer.privacy'), href: '#' },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/5 bg-ink">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        {/* Main row: wordmark left, link columns right */}
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          {/* Oversized ghosted wordmark */}
          <div className="shrink-0 select-none" aria-hidden="true">
            <span
              className="font-display text-[4rem] leading-none font-bold tracking-tight text-foreground/15 sm:text-[5rem]"
              data-display-text="true"
            >
              SYNCODE
            </span>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 sm:gap-x-16">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground/50 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-16 flex flex-col items-start gap-4 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {/* PairMascot idle goes here */}
          </div>

          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-6">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/50">
              {t('footer.tagline')}
            </span>
            <span className="text-xs text-muted-foreground/30">
              &copy; {t('footer.copyright', { year })}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
