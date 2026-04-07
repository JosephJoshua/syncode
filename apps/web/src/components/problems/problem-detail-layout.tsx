import type { ProblemDetail, ProblemExample, ProblemTestCase } from '@syncode/contracts';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';
import { Button } from '@syncode/ui';
import { Bookmark, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useToggleProblemBookmarkMutation } from '@/lib/problems/problem-bookmark';
import { useAuthStore } from '@/stores/auth.store';
import { StarterCodeBlock } from './starter-code-block';
import { formatStarterLanguageLabel } from './starter-code-language';

export function ProblemDetailLayout({ problem }: { problem: ProblemDetail }) {
  const { t } = useTranslation('problems');
  const starterLanguages = getStarterLanguages(problem.starterCode);
  const firstLanguage = starterLanguages[0] ?? null;
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(firstLanguage);
  const publicTestCases = useMemo(
    () => problem.testCases.filter((testCase) => !testCase.isHidden),
    [problem.testCases],
  );
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const toggleBookmarkMutation = useToggleProblemBookmarkMutation(problem.id);

  useEffect(() => {
    if (!problem.starterCode) {
      setSelectedLanguage(null);
      return;
    }

    if (!selectedLanguage || !(selectedLanguage in problem.starterCode)) {
      setSelectedLanguage(firstLanguage);
    }
  }, [firstLanguage, problem.starterCode, selectedLanguage]);

  const selectedStarterCode =
    selectedLanguage && problem.starterCode ? problem.starterCode[selectedLanguage] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-7">
        <ProblemHeader
          problem={problem}
          canToggleBookmark={isAuthenticated}
          isBookmarkPending={toggleBookmarkMutation.isPending}
          onToggleBookmark={() =>
            toggleBookmarkMutation.mutate({
              currentIsBookmarked: problem.isBookmarked,
            })
          }
        />

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <SectionSurface title={t('detail.description')}>
              <MarkdownBlock value={problem.description} />
            </SectionSurface>

            <SectionSurface title={t('detail.constraints')}>
              <MarkdownBlock value={problem.constraints ?? t('detail.noConstraints')} />
            </SectionSurface>

            <SectionSurface title={t('detail.examples', { count: problem.examples.length })}>
              <div className="space-y-3">
                {problem.examples.map((example, index) => (
                  <ExamplePanel key={`${example.input}-${index}`} example={example} index={index} />
                ))}
              </div>
            </SectionSurface>
          </div>

          <aside className="space-y-3">
            <SummaryRail problem={problem} />
          </aside>
        </div>

        <SectionSurface title={t('detail.starterCode')}>
          {problem.starterCode && starterLanguages.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {starterLanguages.map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={() => setSelectedLanguage(language)}
                    className={
                      language === selectedLanguage
                        ? 'rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors'
                        : 'rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground'
                    }
                  >
                    {formatStarterLanguageLabel(language)}
                  </button>
                ))}
              </div>

              {selectedLanguage && selectedStarterCode ? (
                <StarterCodeBlock code={selectedStarterCode} language={selectedLanguage} />
              ) : null}
            </div>
          ) : (
            <EmptySurfaceCopy message={t('detail.noStarterCode')} />
          )}
        </SectionSurface>

        <SectionSurface title={t('detail.publicTestCases')}>
          {publicTestCases.length > 0 ? (
            <div className="space-y-3">
              {publicTestCases.map((testCase, index) => (
                <PublicTestCasePanel
                  key={`${testCase.input}-${index}`}
                  testCase={testCase}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <EmptySurfaceCopy message={t('detail.noPublicTestCases')} />
          )}
        </SectionSurface>
      </div>
    </div>
  );
}

function ProblemHeader({
  problem,
  canToggleBookmark,
  isBookmarkPending,
  onToggleBookmark,
}: {
  problem: ProblemDetail;
  canToggleBookmark: boolean;
  isBookmarkPending: boolean;
  onToggleBookmark: () => void;
}) {
  const { t } = useTranslation('problems');
  return (
    <header className="rounded-2xl border border-border/60 bg-card/60 px-5 py-5">
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
        {t('detail.breadcrumb', { title: problem.title })}
      </p>

      <h1 className="mt-3 text-[1.8rem] font-semibold tracking-tight text-foreground sm:text-[2.4rem]">
        {problem.title}
      </h1>

      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} />
            {problem.tags.map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>

          <BookmarkToggleButton
            isBookmarked={problem.isBookmarked}
            canToggleBookmark={canToggleBookmark}
            isPending={isBookmarkPending}
            onToggle={onToggleBookmark}
          />
        </div>

        <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <AttemptStatusBadge attemptStatus={problem.attemptStatus} />
          </div>

          {problem.company ? <MetaChip>{problem.company}</MetaChip> : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {t('detail.lastUpdated', { date: formatDate(problem.updatedAt) })}
        </p>
      </div>
    </header>
  );
}

function SummaryRail({ problem }: { problem: ProblemDetail }) {
  const { t } = useTranslation('problems');
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
      <div className="border-b border-border/60 pb-2.5">
        <Button
          type="button"
          size="lg"
          className="w-full cursor-pointer bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_16px_32px_-16px_hsl(var(--primary)/0.95)]"
        >
          {t('detail.practiceButton')}
        </Button>
      </div>

      <dl className="divide-y divide-border/60">
        <SummaryStat
          label={t('detail.acceptanceRate')}
          value={
            problem.acceptanceRate === null
              ? t('detail.notAvailable')
              : `${problem.acceptanceRate.toFixed(1)}%`
          }
        />
        <SummaryStat
          label={t('detail.totalSubmissions')}
          value={problem.totalSubmissions.toLocaleString('en-US')}
        />
        <SummaryStat label={t('detail.yourAttempts')} value={problem.userAttempts.toString()} />
        <SummaryStat
          label={t('detail.currentStatus')}
          value={formatAttemptStatus(problem.attemptStatus, t)}
        />
      </dl>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 first:pt-2.5 last:pb-0">
      <dt className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function SectionSurface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60">
      <div className="border-b border-border/60 px-4 py-2.5">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function ExamplePanel({ example, index }: { example: ProblemExample; index: number }) {
  const { t } = useTranslation('problems');
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('detail.exampleTitle', { index: index + 1 })}
      </h3>
      <div className="mt-2.5 space-y-2.5">
        <LabeledCodeBlock label={t('detail.input')} value={example.input} />
        <LabeledCodeBlock label={t('detail.output')} value={example.output} />
        {example.explanation ? (
          <LabeledTextBlock label={t('detail.explanation')} value={example.explanation} />
        ) : null}
      </div>
    </div>
  );
}

function PublicTestCasePanel({ testCase, index }: { testCase: ProblemTestCase; index: number }) {
  const { t } = useTranslation('problems');
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('detail.testCaseTitle', { index: index + 1 })}
      </h3>
      <div className="mt-2.5 space-y-2.5">
        <LabeledCodeBlock label={t('detail.input')} value={testCase.input} />
        <LabeledCodeBlock label={t('detail.expectedOutput')} value={testCase.expectedOutput} />
        {testCase.description ? (
          <LabeledTextBlock label={t('detail.explanation')} value={testCase.description} />
        ) : null}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <InlineStat
            label={t('detail.timeLimit')}
            value={testCase.timeoutMs ? `${testCase.timeoutMs} ms` : t('detail.default')}
          />
          <InlineStat
            label={t('detail.memoryLimit')}
            value={testCase.memoryMb ? `${testCase.memoryMb} MB` : t('detail.default')}
          />
        </div>
      </div>
    </div>
  );
}

function LabeledCodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <pre className="mt-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/70 px-3.5 py-2 text-sm leading-[1.625rem] text-foreground">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function LabeledTextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 rounded-lg border border-border/60 bg-muted/50 px-3.5 py-2 text-sm leading-[1.625rem] text-foreground">
        {value}
      </p>
    </div>
  );
}

function MarkdownBlock({ value }: { value: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-code:rounded prose-code:bg-muted/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foreground prose-pre:bg-muted/70 prose-li:marker:text-muted-foreground">
      <Markdown>{value}</Markdown>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/70 px-3.5 py-2">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function EmptySurfaceCopy({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function TagChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-cyan-400/45 bg-cyan-400/14 px-3 py-1.5 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/12">
      {children}
    </span>
  );
}

function BookmarkToggleButton({
  isBookmarked,
  canToggleBookmark,
  isPending,
  onToggle,
}: {
  isBookmarked: boolean;
  canToggleBookmark: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('problems');
  const isDisabled = !canToggleBookmark || isPending;
  const label = !canToggleBookmark
    ? t('detail.signInBookmarks')
    : isBookmarked
      ? t('detail.removeBookmark')
      : t('detail.addBookmark');

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      aria-pressed={isBookmarked}
      title={label}
      disabled={isDisabled}
      onClick={onToggle}
      className={
        isBookmarked
          ? 'rounded-full border border-amber-400/40 bg-amber-500/14 text-amber-300 ring-1 ring-amber-400/12 hover:border-amber-300/50 hover:bg-amber-500/18 hover:text-amber-200 disabled:opacity-100'
          : 'rounded-full border border-amber-400/45 bg-transparent text-amber-300 ring-1 ring-amber-400/10 hover:border-amber-300/55 hover:bg-amber-500/10 hover:text-amber-200 disabled:opacity-100'
      }
    >
      {isPending ? (
        <LoaderCircle className="size-4 animate-spin" strokeWidth={1.9} />
      ) : (
        <Bookmark className={isBookmarked ? 'size-4 fill-current' : 'size-4'} strokeWidth={1.9} />
      )}
    </Button>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: ProblemDetail['difficulty'] }) {
  const { t } = useTranslation('problems');
  if (difficulty === 'easy') {
    return (
      <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/14 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/10">
        {t('detail.easy')}
      </span>
    );
  }

  if (difficulty === 'medium') {
    return (
      <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/14 px-3 py-1.5 text-xs font-semibold text-orange-300 ring-1 ring-orange-400/10">
        {t('detail.medium')}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-rose-400/30 bg-rose-500/14 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/10">
      {t('detail.hard')}
    </span>
  );
}

function AttemptStatusBadge({ attemptStatus }: { attemptStatus: ProblemDetail['attemptStatus'] }) {
  const { t } = useTranslation('problems');
  if (attemptStatus) {
    return (
      <span className="inline-flex rounded-full border border-violet-400/34 bg-violet-500/16 px-3 py-1.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-400/12">
        {formatAttemptStatus(attemptStatus, t)}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-violet-400/24 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200/90 ring-1 ring-violet-400/8">
      {formatAttemptStatus(attemptStatus, t)}
    </span>
  );
}

function getStarterLanguages(starterCode: ProblemDetail['starterCode']) {
  if (!starterCode) {
    return [];
  }

  return SUPPORTED_LANGUAGES.filter((language) => typeof starterCode[language] === 'string');
}

function formatAttemptStatus(status: ProblemDetail['attemptStatus'], t: (key: string) => string) {
  if (status === 'solved') {
    return t('detail.solved');
  }

  if (status === 'attempted') {
    return t('detail.attempted');
  }

  return t('detail.noAttemptsYet');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
