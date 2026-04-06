import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@syncode/shared';
import { Button } from '@syncode/ui';
import { Bookmark, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useToggleProblemBookmarkMutation } from '@/lib/problems/problem-bookmark';
import { isProblemDetailMockEnabled } from '@/lib/problems/problem-detail';
import type {
  ProblemDetailResponse,
  ProblemExample,
  ProblemTestCase,
} from '@/lib/problems/problem-detail.mock';
import { useAuthStore } from '@/stores/auth.store';
import { StarterCodeBlock } from './starter-code-block';
import { formatStarterLanguageLabel } from './starter-code-language';

export function ProblemDetailLayout({ problem }: { problem: ProblemDetailResponse }) {
  const starterLanguages = getStarterLanguages(problem.starterCode);
  const firstLanguage = starterLanguages[0] ?? null;
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(firstLanguage);
  const publicTestCases = problem.testCases.filter((testCase) => !testCase.isHidden);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const canToggleBookmark = isAuthenticated || isProblemDetailMockEnabled();
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
          canToggleBookmark={canToggleBookmark}
          isBookmarkPending={toggleBookmarkMutation.isPending}
          onToggleBookmark={() =>
            toggleBookmarkMutation.mutate({
              currentIsBookmarked: problem.isBookmarked,
            })
          }
        />

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <SectionSurface title="Description">
              <MarkdownBlock value={problem.description} />
            </SectionSurface>

            <SectionSurface title="Constraints">
              <MarkdownBlock value={problem.constraints ?? 'No constraints provided yet.'} />
            </SectionSurface>

            <SectionSurface title={`Examples (${problem.examples.length})`}>
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

        <SectionSurface title="Starter Code">
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
            <EmptySurfaceCopy message="No starter code is available for this problem yet." />
          )}
        </SectionSurface>

        <SectionSurface title="Public Test Cases">
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
            <EmptySurfaceCopy message="No public test cases are available yet." />
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
  problem: ProblemDetailResponse;
  canToggleBookmark: boolean;
  isBookmarkPending: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <header className="rounded-2xl border border-border/60 bg-card/60 px-5 py-5">
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
        problems / {problem.title}
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
          Last updated: {formatDate(problem.updatedAt)}
        </p>
      </div>
    </header>
  );
}

function SummaryRail({ problem }: { problem: ProblemDetailResponse }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
      <div className="border-b border-border/60 pb-2.5">
        <Button
          type="button"
          size="lg"
          className="w-full cursor-pointer bg-primary text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.9)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_16px_32px_-16px_hsl(var(--primary)/0.95)]"
        >
          Practice this problem
        </Button>
      </div>

      <dl className="divide-y divide-border/60">
        <SummaryStat
          label="Acceptance Rate"
          value={
            problem.acceptanceRate === null
              ? 'Not available'
              : `${problem.acceptanceRate.toFixed(1)}%`
          }
        />
        <SummaryStat
          label="Total Submissions"
          value={problem.totalSubmissions.toLocaleString('en-US')}
        />
        <SummaryStat label="Your Attempts" value={problem.userAttempts.toString()} />
        <SummaryStat label="Current Status" value={formatAttemptStatus(problem.attemptStatus)} />
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
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <h3 className="text-sm font-semibold text-foreground">Example {index + 1}</h3>
      <div className="mt-2.5 space-y-2.5">
        <LabeledCodeBlock label="Input" value={example.input} />
        <LabeledCodeBlock label="Output" value={example.output} />
        {example.explanation ? (
          <LabeledTextBlock label="Explanation" value={example.explanation} />
        ) : null}
      </div>
    </div>
  );
}

function PublicTestCasePanel({ testCase, index }: { testCase: ProblemTestCase; index: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-3">
      <h3 className="text-sm font-semibold text-foreground">Test Case {index + 1}</h3>
      <div className="mt-2.5 space-y-2.5">
        <LabeledCodeBlock label="Input" value={testCase.input} />
        <LabeledCodeBlock label="Expected Output" value={testCase.expectedOutput} />
        {testCase.description ? (
          <LabeledTextBlock label="Description" value={testCase.description} />
        ) : null}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <InlineStat
            label="Time Limit"
            value={testCase.timeoutMs ? `${testCase.timeoutMs} ms` : 'Default'}
          />
          <InlineStat
            label="Memory Limit"
            value={testCase.memoryMb ? `${testCase.memoryMb} MB` : 'Default'}
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
      <pre className="mt-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/70 px-3.5 py-2 text-sm leading-6.5 text-foreground">
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
      <p className="mt-1 rounded-lg border border-border/60 bg-muted/50 px-3.5 py-2 text-sm leading-6.5 text-foreground">
        {value}
      </p>
    </div>
  );
}

function MarkdownBlock({ value }: { value: string }) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-foreground">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
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
  const isDisabled = !canToggleBookmark || isPending;
  const label = !canToggleBookmark
    ? 'Sign in to manage bookmarks'
    : isBookmarked
      ? 'Remove bookmark'
      : 'Add bookmark';

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

function DifficultyBadge({ difficulty }: { difficulty: ProblemDetailResponse['difficulty'] }) {
  if (difficulty === 'easy') {
    return (
      <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/14 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/10">
        Easy
      </span>
    );
  }

  if (difficulty === 'medium') {
    return (
      <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/14 px-3 py-1.5 text-xs font-semibold text-orange-300 ring-1 ring-orange-400/10">
        Medium
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-rose-400/30 bg-rose-500/14 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/10">
      Hard
    </span>
  );
}

function AttemptStatusBadge({
  attemptStatus,
}: {
  attemptStatus: ProblemDetailResponse['attemptStatus'];
}) {
  if (attemptStatus === 'solved') {
    return (
      <span className="inline-flex rounded-full border border-violet-400/34 bg-violet-500/16 px-3 py-1.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-400/12">
        Solved
      </span>
    );
  }

  if (attemptStatus === 'attempted') {
    return (
      <span className="inline-flex rounded-full border border-violet-400/34 bg-violet-500/16 px-3 py-1.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-400/12">
        Attempted
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-violet-400/24 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200/90 ring-1 ring-violet-400/8">
      No attempts yet
    </span>
  );
}

function getStarterLanguages(starterCode: ProblemDetailResponse['starterCode']) {
  if (!starterCode) {
    return [];
  }

  return SUPPORTED_LANGUAGES.filter((language) => typeof starterCode[language] === 'string');
}

function formatAttemptStatus(status: ProblemDetailResponse['attemptStatus']) {
  if (status === 'solved') {
    return 'Solved';
  }

  if (status === 'attempted') {
    return 'Attempted';
  }

  return 'No attempts yet';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
