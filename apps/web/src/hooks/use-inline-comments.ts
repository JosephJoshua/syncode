import { useEffect, useMemo, useState } from 'react';
import { INLINE_COMMENTS_KEY } from '@syncode/shared';
import type * as Y from 'yjs';
import {
  addInlineComment,
  deleteInlineComment,
  getInlineCommentLineNumbers,
  listInlineComments,
  updateInlineComment,
  type InlineComment,
} from '@/lib/inline-comments.js';
import { CODE_TEXT_KEY } from '@/lib/yjs-collab-provider.js';

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

export function useInlineComments(doc: Y.Doc | null): UseInlineCommentsResult {
  const [comments, setComments] = useState<InlineComment[]>([]);

  useEffect(() => {
    if (!doc) {
      setComments([]);
      return;
    }

    const commentsMap = doc.getMap(INLINE_COMMENTS_KEY);
    const codeText = doc.getText(CODE_TEXT_KEY);
    const syncComments = () => {
      setComments(listInlineComments(doc));
    };

    syncComments();
    commentsMap.observeDeep(syncComments);
    codeText.observe(syncComments);

    return () => {
      commentsMap.unobserveDeep(syncComments);
      codeText.unobserve(syncComments);
    };
  }, [doc]);

  const commentLineNumbers = useMemo(() => {
    if (!doc) {
      return [];
    }

    return getInlineCommentLineNumbers(doc);
  }, [doc, comments]);

  return {
    comments,
    commentLineNumbers,
    addComment: (input) => {
      if (!doc) {
        return;
      }

      addInlineComment(doc, input);
    },
    updateComment: (commentId, patch) => {
      if (!doc) {
        return;
      }

      updateInlineComment(doc, commentId, patch);
    },
    deleteComment: (commentId) => {
      if (!doc) {
        return;
      }

      deleteInlineComment(doc, commentId);
    },
  };
}
