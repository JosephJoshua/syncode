import { INLINE_COMMENTS_KEY } from '@syncode/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import {
  addInlineComment,
  deleteInlineComment,
  type InlineComment,
  type InlineCommentTextDelta,
  listInlineComments,
  reconcileInlineCommentsForCodeChange,
  updateInlineComment,
} from '@/lib/inline-comments.js';
import { codeTextKey } from '@/lib/yjs-collab-provider.js';

export interface UseInlineCommentsResult {
  comments: InlineComment[];
  commentLineNumbers: number[];
  addComment: (input: {
    authorId: string;
    authorName: string;
    content: string;
    lineNumber: number;
  }) => void;
  updateComment: (commentId: string, patch: { content?: string; lineNumber?: number }) => void;
  deleteComment: (commentId: string) => void;
}

export function useInlineComments(
  doc: Y.Doc | null,
  language: string = 'python',
): UseInlineCommentsResult {
  const [comments, setComments] = useState<InlineComment[]>([]);
  const previousCodeRef = useRef('');

  useEffect(() => {
    if (!doc) {
      setComments([]);
      previousCodeRef.current = '';
      return;
    }

    const commentsMap = doc.getMap(INLINE_COMMENTS_KEY);
    const codeText = doc.getText(codeTextKey(language));
    previousCodeRef.current = codeText.toString();

    const syncComments = () => {
      setComments(listInlineComments(doc, language));
    };
    const handleCodeChange = (event: Y.YTextEvent) => {
      const previousCode = previousCodeRef.current;
      const nextCode = codeText.toString();
      const delta = event.changes.delta as InlineCommentTextDelta;

      if (previousCode.length === 0 && commentsMap.size > 0) {
        previousCodeRef.current = nextCode;
        syncComments();
        return;
      }

      reconcileInlineCommentsForCodeChange(doc, language, previousCode, nextCode, delta);
      previousCodeRef.current = nextCode;
      syncComments();
    };

    syncComments();
    commentsMap.observeDeep(syncComments);
    codeText.observe(handleCodeChange);

    return () => {
      commentsMap.unobserveDeep(syncComments);
      codeText.unobserve(handleCodeChange);
    };
  }, [doc, language]);

  const commentLineNumbers = useMemo(
    () =>
      [...new Set(comments.map((comment) => comment.lineNumber))]
        .filter((lineNumber) => Number.isFinite(lineNumber) && lineNumber > 0)
        .sort((left, right) => left - right),
    [comments],
  );

  return {
    comments,
    commentLineNumbers,
    addComment: (input) => {
      if (!doc) {
        return;
      }

      addInlineComment(doc, input, language);
    },
    updateComment: (commentId, patch) => {
      if (!doc) {
        return;
      }

      updateInlineComment(doc, commentId, patch, language);
    },
    deleteComment: (commentId) => {
      if (!doc) {
        return;
      }

      deleteInlineComment(doc, commentId);
    },
  };
}
