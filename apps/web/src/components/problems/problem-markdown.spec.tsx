import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProblemMarkdown } from './problem-markdown.js';

describe('ProblemMarkdown', () => {
  it('GIVEN valid markdown with bold and lists THEN renders structured HTML', () => {
    const content = '# Heading\n\n**bold text**\n\n- item one\n- item two';
    const { container } = render(<ProblemMarkdown content={content} />);

    expect(container.querySelector('h1')).not.toBeNull();
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('bold text')).toBeInTheDocument();
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
  });

  it('GIVEN markdown containing raw <script> THEN the script tag is not rendered in the DOM', () => {
    const content = 'safe prefix\n\n<script>window.__xss = true;</script>\n\nsafe suffix';
    const { container } = render(<ProblemMarkdown content={content} />);

    expect(container.querySelector('script')).toBeNull();
  });

  it('GIVEN a markdown table WHEN rendered THEN the table element is in the DOM', () => {
    const content = '| name | value |\n| --- | --- |\n| foo | 1 |\n| bar | 2 |';
    const { container } = render(<ProblemMarkdown content={content} />);

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('tr').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('GIVEN a link WHEN rendered THEN the anchor has target="_blank" and rel contains "noopener" and "noreferrer"', () => {
    const content = '[external link](https://example.com)';
    render(<ProblemMarkdown content={content} />);

    const link = screen.getByRole('link', { name: 'external link' });
    expect(link).toHaveAttribute('target', '_blank');
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('GIVEN compact prop THEN the rendered element has a class differentiating it from default', () => {
    const { container: defaultContainer } = render(<ProblemMarkdown content="hello" />);
    const { container: compactContainer } = render(<ProblemMarkdown content="hello" compact />);

    const defaultWrapper = defaultContainer.firstElementChild;
    const compactWrapper = compactContainer.firstElementChild;

    expect(defaultWrapper).not.toBeNull();
    expect(compactWrapper).not.toBeNull();
    expect(compactWrapper?.className).not.toBe(defaultWrapper?.className);
    expect(compactWrapper?.className).toContain('text-xs');
    expect(defaultWrapper?.className).not.toContain('text-xs');
  });
});
