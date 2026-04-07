import type { SupportedLanguage } from '@syncode/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@syncode/ui';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { LanguageSelector } from '@/components';
import { getLanguageSelectorOption } from '@/components/language-selector.data';

export const Route = createFileRoute('/dev/language-selector')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: '/' });
    }
  },
  component: LanguageSelectorPreviewPage,
});

const PREVIEW_LANGUAGE_SUBSET: readonly SupportedLanguage[] = ['go', 'python', 'rust'];

function LanguageSelectorPreviewPage() {
  const [defaultLanguage, setDefaultLanguage] = useState<SupportedLanguage>('typescript');
  const [subsetLanguage, setSubsetLanguage] = useState<SupportedLanguage>('python');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10 lg:py-12">
      <section className="max-w-3xl space-y-3">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
          Dev Preview
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Language Selector
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Temporary preview route for the reusable language input control. This page is
          intentionally isolated from rooms, editors, and execution logic.
        </p>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <PreviewCard
          title="Default"
          description="Full shared language list with a controlled value."
          currentLanguage={defaultLanguage}
        >
          <LanguageSelector value={defaultLanguage} onValueChange={setDefaultLanguage} />
        </PreviewCard>

        <PreviewCard
          title="Disabled"
          description="Visual reference for a non-interactive state."
          currentLanguage="typescript"
        >
          <LanguageSelector
            value="typescript"
            onValueChange={() => {}}
            disabled
            placeholder="Unavailable"
          />
        </PreviewCard>

        <PreviewCard
          title="Subset"
          description="Subset passed by parent while preserving shared canonical order."
          currentLanguage={subsetLanguage}
        >
          <LanguageSelector
            value={subsetLanguage}
            onValueChange={setSubsetLanguage}
            languages={PREVIEW_LANGUAGE_SUBSET}
            placeholder="Choose subset language"
          />
        </PreviewCard>
      </section>
    </div>
  );
}

function PreviewCard({
  title,
  description,
  currentLanguage,
  children,
}: {
  title: string;
  description: string;
  currentLanguage: SupportedLanguage;
  children: ReactNode;
}) {
  return (
    <Card className="border border-border/50 bg-card/80 py-0 backdrop-blur-sm">
      <CardHeader className="space-y-2 px-5 pt-5">
        <CardTitle className="text-lg tracking-tight text-foreground">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {children}
        <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-3">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground/60 uppercase">
            Current language
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {getLanguageSelectorOption(currentLanguage).label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
