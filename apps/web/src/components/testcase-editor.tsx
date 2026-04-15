import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type TestCaseEntry, tabClassName } from './room-workspace-utils.js';

interface TestCaseEditorProps {
  cases: TestCaseEntry[];
  activeCaseId: string;
  onActiveCaseChange: (id: string) => void;
  onCaseInputChange: (id: string, input: string) => void;
  onAddCase: () => void;
  onRemoveCase: (id: string) => void;
  readOnly: boolean;
}

export function TestCaseEditor({
  cases,
  activeCaseId,
  onActiveCaseChange,
  onCaseInputChange,
  onAddCase,
  onRemoveCase,
  readOnly,
}: TestCaseEditorProps) {
  const { t } = useTranslation('rooms');

  const activeCase = cases.find((c) => c.id === activeCaseId);

  if (cases.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-xs text-muted-foreground/40">{t('workspace.noTestcases')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable tab bar */}
      <div
        className="flex h-7 shrink-0 items-center overflow-x-auto border-b border-border/60"
        style={{ scrollbarWidth: 'none' }}
      >
        {cases.map((c) => (
          <div
            key={c.id}
            className={`group flex shrink-0 items-center ${tabClassName(c.id === activeCaseId)}`}
          >
            <button
              type="button"
              onClick={() => onActiveCaseChange(c.id)}
              className="whitespace-nowrap"
            >
              {c.label}
            </button>
            {!c.fromProblem && !readOnly ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveCase(c.id);
                }}
                className="ml-1.5 rounded-sm opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            ) : null}
          </div>
        ))}
        {!readOnly ? (
          <button
            type="button"
            onClick={onAddCase}
            className="shrink-0 px-2 py-1 text-muted-foreground/50 transition-colors hover:text-primary"
            title={t('workspace.addTestcase')}
          >
            <Plus size={12} />
          </button>
        ) : null}
      </div>

      {/* Active case content */}
      {activeCase ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-1.5">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('workspace.inputLabel')}
          </span>

          <textarea
            value={activeCase.input}
            onChange={(e) => onCaseInputChange(activeCase.id, e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            rows={Math.max(1, (activeCase.input.match(/\n/g)?.length ?? 0) + 1)}
            className="shrink-0 resize-none bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
          />

          {activeCase.expectedOutput !== null ? (
            <div className="shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t('workspace.expectedOutput')}
              </span>
              <pre className="mt-0.5 max-h-16 overflow-auto rounded border border-border/40 bg-background/50 p-1.5 font-mono text-[11px] text-foreground/60">
                {activeCase.expectedOutput}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
