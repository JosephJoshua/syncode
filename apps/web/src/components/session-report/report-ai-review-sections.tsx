import { AiFeedbackText } from '@/components/session-report/ai-feedback-rich-text.js';

export function SummaryList({ title, items }: { title: string; items: string[] }) {
  const visibleItems = items.slice(0, 3);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
        {visibleItems.map((item) => (
          <li key={`${title}-${item}`} className="rounded-xl bg-background/60 px-3 py-2.5">
            <AiFeedbackText text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompactInsightCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/50">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      <dl className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </dt>
            <dd className="text-sm font-medium text-foreground">
              <AiFeedbackText text={value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
