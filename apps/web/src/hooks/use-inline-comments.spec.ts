import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';
import { useInlineComments } from './use-inline-comments.js';

const TEST_LANGUAGE = 'python';

function makeDoc(code = 'line1\nline2\nline3') {
  const doc = new Y.Doc();
  doc.getText(codeTextKey(TEST_LANGUAGE)).insert(0, code);
  return doc;
}

describe('useInlineComments', () => {
  it('GIVEN null doc WHEN rendered THEN returns empty state', () => {
    const { result } = renderHook(() => useInlineComments(null));
    expect(result.current.comments).toEqual([]);
    expect(result.current.commentLineNumbers).toEqual([]);
  });

  it('GIVEN a doc WHEN a comment is added THEN comments list updates reactively', async () => {
    const doc = makeDoc();
    const { result } = renderHook(() => useInlineComments(doc));

    expect(result.current.comments).toHaveLength(0);

    act(() => {
      result.current.addComment({
        authorId: 'u1',
        authorName: 'Alice',
        content: 'Nice',
        lineNumber: 1,
      });
    });

    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]?.content).toBe('Nice');
    expect(result.current.commentLineNumbers).toEqual([1]);
    doc.destroy();
  });

  it('GIVEN a comment WHEN updated THEN content is reflected', () => {
    const doc = makeDoc();
    const { result } = renderHook(() => useInlineComments(doc));

    act(() => {
      result.current.addComment({
        authorId: 'u1',
        authorName: 'Alice',
        content: 'Original',
        lineNumber: 2,
      });
    });

    const id = result.current.comments[0]?.id ?? '';

    act(() => {
      result.current.updateComment(id, { content: 'Revised' });
    });

    expect(result.current.comments[0]?.content).toBe('Revised');
    doc.destroy();
  });

  it('GIVEN a comment WHEN deleted THEN list is empty', () => {
    const doc = makeDoc();
    const { result } = renderHook(() => useInlineComments(doc));

    act(() => {
      result.current.addComment({
        authorId: 'u1',
        authorName: 'Alice',
        content: 'Remove me',
        lineNumber: 3,
      });
    });

    const id = result.current.comments[0]?.id ?? '';

    act(() => {
      result.current.deleteComment(id);
    });

    expect(result.current.comments).toHaveLength(0);
    doc.destroy();
  });

  it('GIVEN code insertion above a comment WHEN code changes THEN line number tracks with CRDT anchor', async () => {
    const doc = makeDoc('alpha\nbeta');
    const { result } = renderHook(() => useInlineComments(doc));

    act(() => {
      result.current.addComment({
        authorId: 'u1',
        authorName: 'Alice',
        content: 'On beta',
        lineNumber: 2,
      });
    });

    act(() => {
      doc.getText(codeTextKey(TEST_LANGUAGE)).insert(0, 'prefix\n');
    });

    expect(result.current.comments[0]?.lineNumber).toBe(3);
    doc.destroy();
  });
});
