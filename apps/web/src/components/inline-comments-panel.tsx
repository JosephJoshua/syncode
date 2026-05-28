import { Button, cn } from '@syncode/ui';
import { MessageSquareMore, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InlineComment } from '@/lib/inline-comments.js';
import { InlineCommentMarkdown } from './inline-comment-markdown.js';

interface InlineCommentsPanelProps {
  comments: InlineComment[];
  activeLineNumber: number;
  disabled?: boolean;
  onActiveLineChange: (lineNumber: number) => void;
  onAddComment: (content: string) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function InlineCommentsPanel({
  comments,
  activeLineNumber,
  disabled = false,
  onActiveLineChange,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: InlineCommentsPanelProps) {
  const { t } = useTranslation('rooms');
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');

  const commentsForActiveLine = useMemo(
    () => comments.filter((comment) => comment.lineNumber === activeLineNumber),
    [activeLineNumber, comments],
  );

  const submitDraft = () => {
    const normalized = draft.trim();
    if (!normalized || disabled) {
      return;
    }

    onAddComment(normalized);
    setDraft('');
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('workspace.inlineCommentsHeading')}
        </span>
        <span className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground/70">
          {t('workspace.selectedLine', { line: activeLineNumber })}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-2.5">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          disabled={disabled}
          placeholder={t('workspace.inlineCommentsPlaceholder', { line: activeLineNumber })}
          className="min-h-20 w-full resize-none bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {commentsForActiveLine.length > 0
              ? t('workspace.inlineCommentsOnLine', {
                  count: commentsForActiveLine.length,
                  line: activeLineNumber,
                })
              : t('workspace.inlineCommentsEmptyLine', { line: activeLineNumber })}
          </span>
          <Button
            type="button"
            size="xs"
            disabled={disabled || draft.trim().length === 0}
            onClick={submitDraft}
          >
            <Plus className="size-3" />
            {t('workspace.addComment')}
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {comments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/30 px-3 py-4 text-center">
            <MessageSquareMore className="mx-auto size-4 text-muted-foreground/40" />
            <p className="mt-2 font-mono text-[11px] text-muted-foreground/60">
              {t('workspace.inlineCommentsEmpty')}
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isEditing = editingId === comment.id;
            return (
              <div
                key={comment.id}
                className={cn(
                  'rounded-xl border border-border/60 bg-background/40 p-3 transition-colors',
                  comment.lineNumber === activeLineNumber && 'border-primary/35 bg-primary/5',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onActiveLineChange(comment.lineNumber)}
                    className="rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {t('workspace.lineBadge', { line: comment.lineNumber })}
                  </button>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={editingDraft.trim().length === 0}
                          onClick={() => {
                            onUpdateComment(comment.id, editingDraft);
                            setEditingId(null);
                            setEditingDraft('');
                          }}
                        >
                          <Save className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingId(null);
                            setEditingDraft('');
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditingDraft(comment.content);
                          }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onDeleteComment(comment.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-xs font-medium text-foreground">{comment.authorName}</p>
                {isEditing ? (
                  <textarea
                    value={editingDraft}
                    onChange={(event) => setEditingDraft(event.target.value)}
                    rows={3}
                    className="mt-2 min-h-20 w-full resize-none rounded-lg border border-border bg-background/70 px-2.5 py-2 font-mono text-xs text-foreground outline-none"
                  />
                ) : (
                  <InlineCommentMarkdown markdown={comment.content} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
