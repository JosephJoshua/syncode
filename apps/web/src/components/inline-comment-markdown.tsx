import ReactMarkdown, { type Components } from 'react-markdown';

const INLINE_COMMENT_MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => (
    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  pre: ({ children }) => (
    <pre className="mt-2 overflow-auto rounded-md border border-border/60 bg-background/70 p-2 font-mono text-xs text-foreground">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    if (className?.includes('language-')) {
      return <code className={className}>{children}</code>;
    }

    return (
      <code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.9em] text-primary">
        {children}
      </code>
    );
  },
};

export function InlineCommentMarkdown({ markdown }: Readonly<{ markdown: string }>) {
  return <ReactMarkdown components={INLINE_COMMENT_MARKDOWN_COMPONENTS}>{markdown}</ReactMarkdown>;
}
