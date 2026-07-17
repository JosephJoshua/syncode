import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { type AiHighlightColor, splitAiHighlightSegments } from '@/lib/ai-feedback-highlights.js';

function getHighlightClassName(color: AiHighlightColor) {
  switch (color) {
    case 'green':
      return 'font-medium text-primary';
    case 'yellow':
      return 'font-medium text-amber-300';
    case 'orange':
      return 'font-medium text-orange-300';
    case 'red':
      return 'font-medium text-rose-300';
    default:
      return 'font-medium text-foreground';
  }
}

function renderHighlightedString(value: string) {
  let offset = 0;

  return splitAiHighlightSegments(value).map((segment) => {
    const segmentKey = `${segment.type}-${offset}-${segment.value}`;
    offset += segment.value.length;

    if (segment.type === 'text') {
      return <Fragment key={segmentKey}>{segment.value}</Fragment>;
    }

    return (
      <span key={segmentKey} className={getHighlightClassName(segment.color)}>
        {segment.value}
      </span>
    );
  });
}

function renderHighlightedChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return renderHighlightedString(child);
    }

    if (Array.isArray(child)) {
      return renderHighlightedChildren(child);
    }

    if (isValidElement(child)) {
      const elementChildren = (child.props as { children?: ReactNode }).children;

      if (typeof child.type === 'string' && (child.type === 'code' || child.type === 'pre')) {
        return child;
      }

      return cloneElement(child, undefined, renderHighlightedChildren(elementChildren));
    }

    return child;
  });
}

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p>{renderHighlightedChildren(children)}</p>,
  li: ({ children }) => <li>{renderHighlightedChildren(children)}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{renderHighlightedChildren(children)}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/90">{renderHighlightedChildren(children)}</em>
  ),
  code: ({ children, className }) => {
    if (className?.includes('language-')) {
      return <code className={className}>{children}</code>;
    }

    return (
      <code className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.92em] text-primary">
        {children}
      </code>
    );
  },
};

export function AiFeedbackText({ text }: { text: string }) {
  return <>{renderHighlightedString(text)}</>;
}

export function AiFeedbackMarkdown({ markdown }: { markdown: string }) {
  return <ReactMarkdown components={MARKDOWN_COMPONENTS}>{markdown}</ReactMarkdown>;
}
