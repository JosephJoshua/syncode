import { INLINE_COMMENTS_KEY } from '@syncode/shared';
import * as Y from 'yjs';
import { CODE_TEXT_KEY } from './yjs-collab-provider.js';

const INLINE_COMMENT_MAX_LENGTH = 500;

type InlineCommentMap = Y.Map<unknown>;
type InlineCommentsRoot = Y.Map<InlineCommentMap>;

export interface InlineComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  lineNumber: number;
}

export interface CreateInlineCommentInput {
  authorId: string;
  authorName: string;
  content: string;
  lineNumber: number;
}

export function ensureInlineCommentsMap(doc: Y.Doc): InlineCommentsRoot {
  return doc.getMap<InlineCommentMap>(INLINE_COMMENTS_KEY);
}

export function listInlineComments(doc: Y.Doc): InlineComment[] {
  const comments = ensureInlineCommentsMap(doc);
  const code = doc.getText(CODE_TEXT_KEY).toString();
  const mappedComments: InlineComment[] = [];

  comments.forEach((entry, id) => {
    const comment = toInlineComment(doc, code, id, entry);
    if (comment) {
      mappedComments.push(comment);
    }
  });

  return mappedComments.sort((left, right) => {
    if (left.lineNumber !== right.lineNumber) {
      return left.lineNumber - right.lineNumber;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function getInlineCommentLineNumbers(doc: Y.Doc): number[] {
  return [...new Set(listInlineComments(doc).map((comment) => comment.lineNumber))];
}

export function addInlineComment(doc: Y.Doc, input: CreateInlineCommentInput): string {
  const comments = ensureInlineCommentsMap(doc);
  const id = generateInlineCommentId();
  const now = new Date().toISOString();
  const comment = new Y.Map<unknown>();

  doc.transact(() => {
    comment.set('authorId', input.authorId);
    comment.set('authorName', input.authorName.trim() || 'Anonymous');
    comment.set('content', normalizeCommentContent(input.content));
    comment.set('createdAt', now);
    comment.set('updatedAt', now);
    comment.set('anchor', createEncodedRelativePosition(doc, input.lineNumber));
    comment.set('lineNumber', input.lineNumber);
    comments.set(id, comment);
  });

  return id;
}

export function updateInlineComment(
  doc: Y.Doc,
  commentId: string,
  patch: { content?: string; lineNumber?: number },
): void {
  const comment = ensureInlineCommentsMap(doc).get(commentId);
  if (!comment) {
    return;
  }

  doc.transact(() => {
    if (patch.content !== undefined) {
      comment.set('content', normalizeCommentContent(patch.content));
    }

    if (patch.lineNumber !== undefined) {
      comment.set('anchor', createEncodedRelativePosition(doc, patch.lineNumber));
      comment.set('lineNumber', patch.lineNumber);
    }

    comment.set('updatedAt', new Date().toISOString());
  });
}

export function deleteInlineComment(doc: Y.Doc, commentId: string): void {
  ensureInlineCommentsMap(doc).delete(commentId);
}

function toInlineComment(
  doc: Y.Doc,
  code: string,
  id: string,
  entry: InlineCommentMap,
): InlineComment | null {
  const content = entry.get('content');
  const authorId = entry.get('authorId');
  const authorName = entry.get('authorName');
  const createdAt = entry.get('createdAt');
  const updatedAt = entry.get('updatedAt');

  if (
    typeof content !== 'string' ||
    typeof authorId !== 'string' ||
    typeof authorName !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id,
    authorId,
    authorName,
    content,
    createdAt,
    updatedAt,
    lineNumber: resolveInlineCommentLineNumber(doc, code, entry),
  };
}

function resolveInlineCommentLineNumber(doc: Y.Doc, code: string, entry: InlineCommentMap): number {
  const anchor = entry.get('anchor');
  if (Array.isArray(anchor) && anchor.every((item) => typeof item === 'number')) {
    const decoded = Y.decodeRelativePosition(Uint8Array.from(anchor));
    const absolute = Y.createAbsolutePositionFromRelativePosition(decoded, doc);
    if (absolute?.type === doc.getText(CODE_TEXT_KEY)) {
      return offsetToLineNumber(code, absolute.index);
    }
  }

  const fallbackLine = entry.get('lineNumber');
  return typeof fallbackLine === 'number' && Number.isFinite(fallbackLine) && fallbackLine > 0
    ? fallbackLine
    : 1;
}

function createEncodedRelativePosition(doc: Y.Doc, lineNumber: number): number[] {
  const codeText = doc.getText(CODE_TEXT_KEY);
  const code = codeText.toString();
  const offset = lineNumberToOffset(code, lineNumber);
  const relativePosition = Y.createRelativePositionFromTypeIndex(codeText, offset);
  return Array.from(Y.encodeRelativePosition(relativePosition));
}

function lineNumberToOffset(code: string, lineNumber: number): number {
  const normalizedLine = Math.max(1, Math.floor(lineNumber));
  if (normalizedLine === 1) {
    return 0;
  }

  let currentLine = 1;
  for (let index = 0; index < code.length; index++) {
    if (code[index] === '\n') {
      currentLine += 1;
      if (currentLine === normalizedLine) {
        return index + 1;
      }
    }
  }

  return code.length;
}

function offsetToLineNumber(code: string, offset: number): number {
  const boundedOffset = Math.max(0, Math.min(offset, code.length));
  let lineNumber = 1;

  for (let index = 0; index < boundedOffset; index++) {
    if (code[index] === '\n') {
      lineNumber += 1;
    }
  }

  return lineNumber;
}

function normalizeCommentContent(content: string): string {
  const normalized = content.trim();
  return normalized.slice(0, INLINE_COMMENT_MAX_LENGTH);
}

function generateInlineCommentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `comment-${Date.now()}-${suffix}`;
  }

  // Final fallback for environments without Web Crypto.
  return `comment-${Date.now()}-${Date.now().toString(36)}`;
}
