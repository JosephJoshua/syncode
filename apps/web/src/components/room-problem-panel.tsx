import Editor from '@monaco-editor/react';
import { Badge, Button } from '@syncode/ui';
import { FileText, Lightbulb, Loader2, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown, { type Components } from 'react-markdown';
import { ConstraintsBlock } from './problems/constraints-block.js';
import { ProblemMarkdown } from './problems/problem-markdown.js';
import { EDITOR_OPTIONS_BASE, handleEditorWillMount } from './room-workspace-utils.js';

export interface ProblemData {
  title: string;
  difficulty: string;
  tags: string[];
  description: string;
  constraints: string | null;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
}

export interface RoomHintItem {
  id: string;
  hint: string;
  suggestedApproach?: string;
  reflectionPrompt?: string;
  reflectionResponse?: string;
  followUpHint?: string;
  createdAt: number;
}

const DIFFICULTY_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
};

interface RoomProblemPanelProps {
  problem: ProblemData | null;
  loading: boolean;
  error: string | null;
  hasProblem: boolean;
  activeTab: 'problem' | 'hints';
  onTabChange: (tab: 'problem' | 'hints') => void;
  hints: RoomHintItem[];
  hintLoading: boolean;
  hintError: string | null;
  onRequestHint: () => void;
  onSubmitHintReflection: (hintId: string, reflectionResponse: string | null) => void;
  followUpLoadingHintId: string | null;
  canRequestHint: boolean;
}

export function RoomProblemPanel({
  problem,
  loading,
  error,
  hasProblem,
  activeTab,
  onTabChange,
  hints,
  hintLoading,
  hintError,
  onRequestHint,
  onSubmitHintReflection,
  followUpLoadingHintId,
  canRequestHint,
}: RoomProblemPanelProps) {
  const { t } = useTranslation('rooms');

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('problem.heading')}
          </span>
          {hasProblem && canRequestHint ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 gap-1.5 px-2 text-[10px]"
              onClick={onRequestHint}
              disabled={hintLoading}
            >
              {hintLoading ? <Loader2 className="size-3 animate-spin" /> : <Lightbulb size={12} />}
              {t('problem.getHint')}
            </Button>
          ) : null}
        </div>

        {hasProblem ? (
          <div className="mt-2 flex items-center gap-1 rounded-md border border-border/70 bg-background/40 p-1">
            <button
              type="button"
              onClick={() => onTabChange('problem')}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'problem'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
              }`}
            >
              {t('problem.tabProblem')}
            </button>
            <button
              type="button"
              onClick={() => onTabChange('hints')}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'hints'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
              }`}
            >
              {t('problem.tabHints')}
            </button>
            {activeTab === 'hints' ? (
              <button
                type="button"
                onClick={() => onTabChange('problem')}
                className="ml-auto inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                aria-label={t('problem.closeHints')}
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasProblem ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText size={24} className="mb-3 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">{t('problem.noProblem')}</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        ) : activeTab === 'hints' ? (
          <HintsContent
            hints={hints}
            loading={hintLoading}
            error={hintError}
            onSubmitHintReflection={onSubmitHintReflection}
            followUpLoadingHintId={followUpLoadingHintId}
          />
        ) : problem ? (
          <ProblemContent problem={problem} />
        ) : null}
      </div>
    </div>
  );
}

function ProblemContent({ problem }: { problem: ProblemData }) {
  const { t } = useTranslation('rooms');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{problem.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant={DIFFICULTY_VARIANT[problem.difficulty] ?? 'neutral'} size="sm">
            {problem.difficulty}
          </Badge>
          {problem.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <ProblemMarkdown content={problem.description} compact />

      {problem.examples.length > 0 ? (
        <div className="space-y-2.5">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('problem.examples')}
          </h3>
          {problem.examples.map((example) => (
            <div
              key={`${example.input}:${example.output}`}
              className="space-y-1.5 rounded border-l-2 border-primary/40 bg-muted/40 p-2.5"
            >
              <div>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  {t('problem.input')}
                </span>
                <pre className="mt-0.5 rounded bg-background p-1.5 font-mono text-[11px] text-foreground/80">
                  {example.input}
                </pre>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  {t('problem.output')}
                </span>
                <pre className="mt-0.5 rounded bg-background p-1.5 font-mono text-[11px] text-foreground/80">
                  {example.output}
                </pre>
              </div>
              {example.explanation ? (
                <div className="text-[11px] italic text-muted-foreground">
                  <ProblemMarkdown content={example.explanation} compact />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {problem.constraints ? (
        <ConstraintsBlock title={t('problem.constraints')} content={problem.constraints} compact />
      ) : null}
    </div>
  );
}

function HintsContent({
  hints,
  loading,
  error,
  onSubmitHintReflection,
  followUpLoadingHintId,
}: {
  hints: RoomHintItem[];
  loading: boolean;
  error: string | null;
  onSubmitHintReflection: (hintId: string, reflectionResponse: string | null) => void;
  followUpLoadingHintId: string | null;
}) {
  const { t } = useTranslation('rooms');
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
          <Loader2 className="size-3 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">{t('problem.hintGenerating')}</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      ) : null}

      {hints.length === 0 && !loading ? (
        <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">{t('problem.hintEmpty')}</p>
        </div>
      ) : null}

      {hints.map((hint, index) => (
        <article key={hint.id} className="rounded-md border border-border/70 bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary/80">
              {t('problem.hintLabel', { index: hints.length - index })}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {new Date(hint.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <HintMarkdown content={hint.hint} />

          {hint.suggestedApproach ? (
            <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-2.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t('problem.suggestedApproach')}
              </p>
              <HintMarkdown content={hint.suggestedApproach} />
            </div>
          ) : null}

          {hint.reflectionPrompt ? (
            <div className="mt-3 space-y-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-primary/80">
                {t('problem.hintReflectionPrompt')}
              </p>
              <HintMarkdown content={hint.reflectionPrompt} />

              {hint.followUpHint ? (
                <div className="space-y-2 rounded-md border border-border/60 bg-background/60 p-2.5">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {t('problem.hintReflectionResponse')}
                    </p>
                    <p className="mt-1 text-xs text-foreground">
                      {hint.reflectionResponse?.trim() || t('problem.hintNoReply')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {t('problem.hintFollowUp')}
                    </p>
                    <HintMarkdown content={hint.followUpHint} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={draftReplies[hint.id] ?? ''}
                    onChange={(event) =>
                      setDraftReplies((prev) => ({ ...prev, [hint.id]: event.target.value }))
                    }
                    placeholder={t('problem.hintReflectionPlaceholder')}
                    className="h-20 w-full resize-y rounded-md border border-border/60 bg-background/70 p-2 text-xs text-foreground outline-none ring-primary/40 transition focus:ring-1"
                    disabled={followUpLoadingHintId === hint.id}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[10px]"
                      disabled={followUpLoadingHintId === hint.id}
                      onClick={() => onSubmitHintReflection(hint.id, null)}
                    >
                      {followUpLoadingHintId === hint.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {t('problem.hintNoReplyAction')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      disabled={
                        followUpLoadingHintId === hint.id ||
                        !(draftReplies[hint.id]?.trim().length ?? 0)
                      }
                      onClick={() => {
                        onSubmitHintReflection(hint.id, draftReplies[hint.id] ?? '');
                        setDraftReplies((prev) => ({ ...prev, [hint.id]: '' }));
                      }}
                    >
                      {followUpLoadingHintId === hint.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {t('problem.hintSubmitReflection')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function HintMarkdown({ content }: { content: string }) {
  const components: Components = {
    p: ({ children }) => (
      <p className="text-xs leading-relaxed text-muted-foreground">{children as ReactNode}</p>
    ),
    ul: ({ children }) => (
      <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    code: ({ className, children }) => {
      const raw = String(children ?? '').replace(/\n$/, '');
      const language = resolveMarkdownCodeLanguage(className);
      const codeLineCount = raw.split('\n').length;
      const editorHeight = Math.max(96, Math.min(320, codeLineCount * 20 + 24));

      if (!className?.includes('language-')) {
        return (
          <code className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {raw}
          </code>
        );
      }

      return (
        <div className="my-2 overflow-hidden rounded-md border border-border/60">
          <Editor
            height={`${editorHeight}px`}
            language={language}
            value={raw}
            theme="syncode-dark"
            beforeMount={handleEditorWillMount}
            options={{
              ...EDITOR_OPTIONS_BASE,
              readOnly: true,
              lineNumbers: 'on',
              renderLineHighlight: 'none',
              minimap: { enabled: false },
              folding: false,
              wordWrap: 'on',
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
            }}
          />
        </div>
      );
    },
  };

  return (
    <div className="space-y-2">
      <Markdown components={components}>{content}</Markdown>
    </div>
  );
}

function resolveMarkdownCodeLanguage(className?: string): string {
  const match = /language-([a-zA-Z0-9_+-]+)/.exec(className ?? '');
  const token = (match?.[1] ?? '').toLowerCase();

  switch (token) {
    case 'py':
    case 'python':
      return 'python';
    case 'js':
    case 'javascript':
      return 'javascript';
    case 'ts':
    case 'typescript':
      return 'typescript';
    case 'java':
      return 'java';
    case 'cpp':
    case 'c++':
      return 'cpp';
    case 'c':
      return 'c';
    case 'go':
    case 'golang':
      return 'go';
    case 'rust':
    case 'rs':
      return 'rust';
    case 'json':
      return 'json';
    case 'sql':
      return 'sql';
    case 'bash':
    case 'sh':
      return 'shell';
    default:
      return token || 'plaintext';
  }
}
