import { Eye, EyeOff } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type TLStore, useValue } from 'tldraw';
import { authorColor } from '@/lib/whiteboard-author-color.js';

export interface WhiteboardAuthor {
  authorId: string;
  shapeCount: number;
  annotationCount: number;
  isLive: boolean;
}

interface WhiteboardAuthorLegendProps {
  store: TLStore;
  participantNames: Map<string, string>;
  hiddenAuthors: ReadonlySet<string>;
  onToggleAuthor: (authorId: string) => void;
  showAnnotations: boolean;
  onToggleAnnotations: () => void;
}

export function WhiteboardAuthorLegend({
  store,
  participantNames,
  hiddenAuthors,
  onToggleAuthor,
  showAnnotations,
  onToggleAnnotations,
}: WhiteboardAuthorLegendProps) {
  const { t } = useTranslation('rooms');

  // Recompute on every store change. For very large boards (thousands of
  // shapes) we'd memo into a dedicated atom, but for an interview whiteboard
  // a few hundred shapes is the realistic ceiling.
  const authors = useValue('whiteboard-authors', () => deriveAuthors(store), [store]);

  const annotationTotal = useMemo(
    () => authors.reduce((sum, a) => sum + a.annotationCount, 0),
    [authors],
  );

  if (authors.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="whiteboard-author-legend"
      className="pointer-events-auto absolute bottom-3 right-3 z-10 w-56 rounded-md border border-border bg-card/95 p-2 shadow-lg backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('whiteboard.authors')}
        </span>
        <button
          type="button"
          onClick={onToggleAnnotations}
          aria-label={
            showAnnotations ? t('whiteboard.hideAnnotations') : t('whiteboard.showAnnotations')
          }
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          {showAnnotations ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          <span>{annotationTotal}</span>
        </button>
      </div>
      <ul className="space-y-1">
        {authors.map((author) => {
          const hidden = hiddenAuthors.has(author.authorId);
          const name = participantNames.get(author.authorId) ?? author.authorId.slice(0, 6);
          return (
            <li key={author.authorId}>
              <button
                type="button"
                onClick={() => onToggleAuthor(author.authorId)}
                aria-label={hidden ? `Show shapes by ${name}` : `Hide shapes by ${name}`}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-muted/50"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: authorColor(author.authorId) }}
                  aria-hidden="true"
                />
                <span
                  className={`flex-1 truncate ${hidden ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                >
                  {name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {author.shapeCount + author.annotationCount}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function deriveAuthors(store: TLStore): WhiteboardAuthor[] {
  const map = new Map<string, WhiteboardAuthor>();

  for (const record of store.allRecords()) {
    if (record.typeName !== 'shape' && record.typeName !== 'asset') continue;
    const meta = (record as { meta?: { authorId?: string; layer?: 'drawing' | 'annotation' } })
      .meta;
    const authorId = meta?.authorId;
    if (!authorId) continue;
    const isAnnotation = meta?.layer === 'annotation';
    const entry =
      map.get(authorId) ??
      ({
        authorId,
        shapeCount: 0,
        annotationCount: 0,
        isLive: false,
      } satisfies WhiteboardAuthor);
    if (isAnnotation) {
      entry.annotationCount += 1;
    } else {
      entry.shapeCount += 1;
    }
    map.set(authorId, entry);
  }

  return Array.from(map.values()).sort((a, b) => a.authorId.localeCompare(b.authorId));
}
