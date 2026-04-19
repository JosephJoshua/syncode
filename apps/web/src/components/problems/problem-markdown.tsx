import { cn } from '@syncode/ui';
import type { ComponentPropsWithoutRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ProblemMarkdownProps = {
  content: string;
  className?: string;
  compact?: boolean;
};

const anchorComponent = ({
  node: _node,
  ...props
}: ComponentPropsWithoutRef<'a'> & { node?: unknown }) => (
  <a {...props} target="_blank" rel="noopener noreferrer" />
);

const components = {
  a: anchorComponent,
};

export function ProblemMarkdown({ content, className, compact = false }: ProblemMarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-invert max-w-none text-foreground',
        compact &&
          'prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2 text-xs leading-relaxed',
        'prose-headings:text-foreground prose-strong:text-foreground',
        'prose-a:text-primary prose-a:underline-offset-2 hover:prose-a:text-primary/80',
        'prose-code:rounded prose-code:bg-muted/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:border prose-pre:border-border/60 prose-pre:bg-[#1e1e1e] prose-pre:text-foreground',
        'prose-li:marker:text-muted-foreground',
        'prose-blockquote:border-l-primary/60 prose-blockquote:text-muted-foreground',
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
