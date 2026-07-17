import type { ResizeCorner } from '@/lib/floating-panel-geometry.js';

export interface PanelCornerGripsProps {
  readonly startResize: (corner: ResizeCorner) => (e: React.PointerEvent) => void;
  readonly onResizePointerMove: (e: React.PointerEvent) => void;
  readonly endResize: (e?: React.PointerEvent) => void;
  readonly labels: Readonly<Record<ResizeCorner, string>>;
}

const cornerClasses: Readonly<Record<ResizeCorner, string>> = {
  tl: 'left-0 top-0 cursor-nwse-resize',
  tr: 'right-0 top-0 cursor-nesw-resize',
  bl: 'bottom-0 left-0 cursor-nesw-resize',
  br: 'bottom-0 right-0 cursor-nwse-resize',
};

const dotClasses: Readonly<Record<Exclude<ResizeCorner, 'br'>, string>> = {
  tl: 'left-0.5 top-0.5',
  tr: 'right-0.5 top-0.5',
  bl: 'bottom-0.5 left-0.5',
};

export function PanelCornerGrips({
  startResize,
  onResizePointerMove,
  endResize,
  labels,
}: PanelCornerGripsProps) {
  const corners: Exclude<ResizeCorner, 'br'>[] = ['tl', 'tr', 'bl'];
  return (
    <>
      {corners.map((corner) => (
        <button
          key={corner}
          type="button"
          tabIndex={-1}
          aria-label={labels[corner]}
          className={`group/resize absolute z-10 size-3 bg-transparent p-0 ${cornerClasses[corner]}`}
          onPointerDown={startResize(corner)}
          onPointerMove={onResizePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onLostPointerCapture={endResize}
        >
          <span
            className={`pointer-events-none absolute block size-1.5 rounded-sm bg-muted-foreground/0 transition-colors group-hover/resize:bg-muted-foreground/40 ${dotClasses[corner]}`}
          />
        </button>
      ))}
      <button
        type="button"
        tabIndex={-1}
        aria-label={labels.br}
        className={`group/resize absolute z-10 flex size-4 items-end justify-end bg-transparent p-0 text-muted-foreground/50 hover:text-muted-foreground ${cornerClasses.br}`}
        onPointerDown={startResize('br')}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onLostPointerCapture={endResize}
      >
        <svg viewBox="0 0 10 10" className="size-2.5 pointer-events-none">
          <title>Resize</title>
          <path
            d="M1 9 L9 9 M4 9 L9 4 M7 9 L9 7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
    </>
  );
}
