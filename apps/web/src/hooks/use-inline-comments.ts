import { INLINE_COMMENTS_KEY } from '@syncode/shared';
import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import {
  addInlineComment,
  deleteInlineComment,
  getInlineCommentLineNumbers,
  type InlineComment,
  listInlineComments,
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

  useEffect(() => {
    if (!doc) {
      setComments([]);
      return;
    }

    const commentsMap = doc.getMap(INLINE_COMMENTS_KEY);
    const codeText = doc.getText(codeTextKey(language));
    const syncComments = () => {
      setComments(listInlineComments(doc, language));
    };

    syncComments();
    commentsMap.observeDeep(syncComments);
    codeText.observe(syncComments);

    return () => {
      commentsMap.unobserveDeep(syncComments);
      codeText.unobserve(syncComments);
    };
  }, [doc, language]);

  const commentLineNumbers = doc ? getInlineCommentLineNumbers(doc, language) : [];

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
