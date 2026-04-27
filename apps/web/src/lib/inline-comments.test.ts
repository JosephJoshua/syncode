import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  addInlineComment,
  deleteInlineComment,
  getInlineCommentLineNumbers,
  listInlineComments,
  updateInlineComment,
} from './inline-comments.js';
import { codeTextKey } from './yjs-collab-provider.js';

const CODE_TEXT_KEY = codeTextKey('python');

describe('inline comments', () => {
  it('GIVEN a comment on a line WHEN code is edited above it THEN the resolved line moves with the code', () => {
    const doc = new Y.Doc();
    doc.getText(CODE_TEXT_KEY).insert(0, 'const a = 1;\nconst b = 2;\nconst c = 3;');

    addInlineComment(doc, {
      authorId: 'user-1',
      authorName: 'Alice',
      content: 'Watch this line.',
      lineNumber: 2,
    });

    doc.getText(CODE_TEXT_KEY).insert(0, '// heading\n');

    const [comment] = listInlineComments(doc);
    expect(comment?.lineNumber).toBe(3);
    doc.destroy();
  });

  it('GIVEN multiple comments WHEN listed THEN returns sorted distinct line numbers', () => {
    const doc = new Y.Doc();
    doc.getText(CODE_TEXT_KEY).insert(0, 'a\nb\nc');

    addInlineComment(doc, {
      authorId: 'user-1',
      authorName: 'Alice',
      content: 'Third line.',
      lineNumber: 3,
    });
    addInlineComment(doc, {
      authorId: 'user-2',
      authorName: 'Bob',
      content: 'First line.',
      lineNumber: 1,
    });
    addInlineComment(doc, {
      authorId: 'user-3',
      authorName: 'Cara',
      content: 'Another first line note.',
      lineNumber: 1,
    });

    expect(getInlineCommentLineNumbers(doc)).toEqual([1, 3]);
    doc.destroy();
  });

  it('GIVEN an existing comment WHEN updated and deleted THEN changes are reflected in the shared state', () => {
    const doc = new Y.Doc();
    doc.getText(CODE_TEXT_KEY).insert(0, 'alpha\nbeta');
    const commentId = addInlineComment(doc, {
      authorId: 'user-1',
      authorName: 'Alice',
      content: 'Initial note',
      lineNumber: 1,
    });

    updateInlineComment(doc, commentId, { content: 'Updated note', lineNumber: 2 });
    const [comment] = listInlineComments(doc);
    expect(comment?.content).toBe('Updated note');
    expect(comment?.lineNumber).toBe(2);

    deleteInlineComment(doc, commentId);
    expect(listInlineComments(doc)).toHaveLength(0);
    doc.destroy();
  });
});
