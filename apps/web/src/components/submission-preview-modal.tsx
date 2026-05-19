import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@syncode/ui';
import { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LazyMonacoEditor as Editor } from './lazy-monaco-editor.js';
import {
  EDITOR_LOADING,
  EDITOR_OPTIONS_BASE,
  handleEditorWillMount,
} from './room-workspace-utils.js';

interface SubmissionPreviewModalProps {
  open: boolean;
  code: string;
  language: string;
  fileExtension: string;
  confirmDisabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SubmissionPreviewModal({
  open,
  code,
  language,
  fileExtension,
  confirmDisabled = false,
  onOpenChange,
  onCancel,
  onConfirm,
}: Readonly<SubmissionPreviewModalProps>) {
  const { t } = useTranslation('rooms');

  const editorOptions = useMemo(
    () => ({
      ...EDITOR_OPTIONS_BASE,
      readOnly: true,
      domReadOnly: true,
    }),
    [],
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] flex-col gap-5 overflow-y-auto sm:max-w-4xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('workspace.submissionPreviewTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('workspace.submissionPreviewDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex h-9 items-center justify-between border-b border-border bg-card px-3">
            <div className="flex items-center gap-1.5 rounded-t-md border border-b-0 border-border bg-background px-2.5 py-1">
              <span className="size-2 rounded-full bg-primary/60" />
              <span className="font-mono text-[11px] text-foreground/80">
                solution.{fileExtension}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
              {language}
            </span>
          </div>

          <div
            className="h-[min(420px,55vh)] overflow-hidden"
            data-testid="submission-preview-editor"
          >
            <Suspense fallback={EDITOR_LOADING}>
              <Editor
                height="100%"
                language={language}
                value={code}
                theme="syncode-dark"
                beforeMount={handleEditorWillMount}
                options={editorOptions}
                loading={EDITOR_LOADING}
              />
            </Suspense>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t('workspace.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={confirmDisabled} onClick={onConfirm}>
            {t('workspace.submitCode')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
