import { INLINE_COMMENTS_KEY } from '@syncode/shared';
import * as Y from 'yjs';
import { codeTextKey } from './yjs-collab-provider.js';

const INLINE_COMMENT_MAX_LENGTH = 500;

type InlineCommentMap = Y.Map<unknown>;
type InlineCommentsRoot = Y.Map<InlineCommentMap>;

type InlineCommentDeltaOperation = {
  retain?: number;
  insert?: string | Uint8Array | Record<string, unknown>;
  delete?: number;
};

export type InlineCommentTextDelta = InlineCommentDeltaOperation[];

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

const DEFAULT_INLINE_COMMENT_LANGUAGE = 'python';

export function listInlineComments(
  doc: Y.Doc,
  language: string = DEFAULT_INLINE_COMMENT_LANGUAGE,
): InlineComment[] {
  const comments = ensureInlineCommentsMap(doc);
  const code = doc.getText(codeTextKey(language)).toString();
  const mappedComments: InlineComment[] = [];

  comments.forEach((entry, id) => {
    const comment = toInlineComment(doc, language, code, id, entry);
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

export function getInlineCommentLineNumbers(
  doc: Y.Doc,
  language: string = DEFAULT_INLINE_COMMENT_LANGUAGE,
): number[] {
  return [...new Set(listInlineComments(doc, language).map((comment) => comment.lineNumber))];
}

export function addInlineComment(
  doc: Y.Doc,
  input: CreateInlineCommentInput,
  language: string = DEFAULT_INLINE_COMMENT_LANGUAGE,
): string {
  const comments = ensureInlineCommentsMap(doc);
  const id = generateInlineCommentId();
  const now = new Date().toISOString();
  const comment = new Y.Map<unknown>();
  const maxLine = lineCountFromCode(doc.getText(codeTextKey(language)).toString());

  doc.transact(() => {
    comment.set('authorId', input.authorId);
    comment.set('authorName', input.authorName.trim() || 'Anonymous');
    comment.set('content', normalizeCommentContent(input.content));
    comment.set('createdAt', now);
    comment.set('updatedAt', now);
    comment.set('lineNumber', normalizeLineNumber(input.lineNumber, maxLine));
    comments.set(id, comment);
  });

  return id;
}

export function updateInlineComment(
  doc: Y.Doc,
  commentId: string,
  patch: { content?: string; lineNumber?: number },
  language: string = DEFAULT_INLINE_COMMENT_LANGUAGE,
): void {
  const comment = ensureInlineCommentsMap(doc).get(commentId);
  if (!comment) {
    return;
  }

  const maxLine = lineCountFromCode(doc.getText(codeTextKey(language)).toString());

  doc.transact(() => {
    if (patch.content !== undefined) {
      comment.set('content', normalizeCommentContent(patch.content));
    }

    if (patch.lineNumber !== undefined) {
      comment.set('lineNumber', normalizeLineNumber(patch.lineNumber, maxLine));
      if (comment.has('anchor')) {
        comment.delete('anchor');
      }
    }

    comment.set('updatedAt', new Date().toISOString());
  });
}

export function deleteInlineComment(doc: Y.Doc, commentId: string): void {
  ensureInlineCommentsMap(doc).delete(commentId);
}

export function reconcileInlineCommentsForCodeChange(
  doc: Y.Doc,
  language: string,
  previousCode: string,
  nextCode: string,
  delta: InlineCommentTextDelta,
): void {
  if (previousCode === nextCode || delta.length === 0) {
    return;
  }

  const comments = ensureInlineCommentsMap(doc);
  if (comments.size === 0) {
    return;
  }

  const originalLineById = new Map<string, number>();
  const nextLineById = new Map<string, number>();
  const deletedIds = new Set<string>();

  comments.forEach((entry, id) => {
    const lineNumber = resolveInlineCommentLineNumber(doc, language, previousCode, entry);
    originalLineById.set(id, lineNumber);
    nextLineById.set(id, lineNumber);
  });

  let workingCode = previousCode;
  let cursor = 0;

  for (const operation of delta) {
    const retainLength = normalizeLength(operation.retain);
    if (retainLength > 0) {
      cursor = Math.min(cursor + retainLength, workingCode.length);
    }

    if (typeof operation.insert === 'string' && operation.insert.length > 0) {
      const insertedText = operation.insert;
      const insertedNewlines = countNewlines(insertedText);
      if (insertedNewlines > 0) {
        const { lineNumber: startLine, column } = indexToLinePosition(workingCode, cursor);

        for (const [id, lineNumber] of nextLineById) {
          if (deletedIds.has(id)) {
            continue;
          }

          if (lineNumber > startLine || (lineNumber === startLine && column === 0)) {
            nextLineById.set(id, lineNumber + insertedNewlines);
          }
        }
      }

      workingCode = `${workingCode.slice(0, cursor)}${insertedText}${workingCode.slice(cursor)}`;
      cursor += insertedText.length;
    }

    const deleteLength = normalizeLength(operation.delete);
    if (deleteLength <= 0) {
      continue;
    }

    const deleteEnd = Math.min(cursor + deleteLength, workingCode.length);
    if (deleteEnd <= cursor) {
      continue;
    }

    const deletedText = workingCode.slice(cursor, deleteEnd);
    const deletedNewlines = countNewlines(deletedText);
    const { lineNumber: startLine } = indexToLinePosition(workingCode, cursor);
    const fullyDeletedLines = findFullyDeletedLines(workingCode, cursor, deleteEnd);

    for (const [id, lineNumber] of nextLineById) {
      if (deletedIds.has(id)) {
        continue;
      }

      if (fullyDeletedLines.has(lineNumber)) {
        deletedIds.add(id);
        continue;
      }

      if (deletedNewlines <= 0) {
        continue;
      }

      const highestCollapsedLine = startLine + deletedNewlines;
      if (lineNumber > highestCollapsedLine) {
        nextLineById.set(id, lineNumber - deletedNewlines);
        continue;
      }

      if (lineNumber > startLine) {
        nextLineById.set(id, startLine);
      }
    }

    workingCode = `${workingCode.slice(0, cursor)}${workingCode.slice(deleteEnd)}`;
  }

  const nextMaxLine = lineCountFromCode(nextCode);
  let hasMutations = deletedIds.size > 0;

  for (const [id, lineNumber] of nextLineById) {
    if (deletedIds.has(id)) {
      continue;
    }

    const normalizedLine = normalizeLineNumber(lineNumber, nextMaxLine);
    if (normalizedLine !== lineNumber) {
      nextLineById.set(id, normalizedLine);
    }

    if (originalLineById.get(id) !== normalizedLine) {
      hasMutations = true;
    }
  }

  if (!hasMutations) {
    return;
  }

  doc.transact(() => {
    for (const id of deletedIds) {
      comments.delete(id);
    }

    for (const [id, lineNumber] of nextLineById) {
      if (deletedIds.has(id)) {
        continue;
      }

      const entry = comments.get(id);
      if (!entry) {
        continue;
      }

      if (entry.get('lineNumber') !== lineNumber) {
        entry.set('lineNumber', lineNumber);
      }

      if (entry.has('anchor')) {
        entry.delete('anchor');
      }
    }
  });
}

function toInlineComment(
  doc: Y.Doc,
  language: string,
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
    lineNumber: resolveInlineCommentLineNumber(doc, language, code, entry),
  };
}

function resolveInlineCommentLineNumber(
  doc: Y.Doc,
  language: string,
  code: string,
  entry: InlineCommentMap,
): number {
  const maxLine = lineCountFromCode(code);

  const storedLine = entry.get('lineNumber');
  if (typeof storedLine === 'number' && Number.isFinite(storedLine) && storedLine > 0) {
    return normalizeLineNumber(storedLine, maxLine);
  }

  // Legacy fallback: old documents stored Y.RelativePosition anchors.
  const anchor = entry.get('anchor');
  if (Array.isArray(anchor) && anchor.every((item) => typeof item === 'number')) {
    const decoded = Y.decodeRelativePosition(Uint8Array.from(anchor));
    const absolute = Y.createAbsolutePositionFromRelativePosition(decoded, doc);
    if (absolute?.type === doc.getText(codeTextKey(language))) {
      return normalizeLineNumber(offsetToLineNumber(code, absolute.index), maxLine);
    }
  }

  return 1;
}

function lineCountFromCode(code: string): number {
  return code.split('\n').length;
}

function normalizeLineNumber(lineNumber: number, maxLine: number): number {
  const boundedMax = Math.max(1, Math.floor(maxLine));
  const normalized = Math.floor(lineNumber);
  if (!Number.isFinite(normalized) || normalized < 1) {
    return 1;
  }

  return Math.min(normalized, boundedMax);
}

function normalizeLength(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function countNewlines(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '\n') {
      count += 1;
    }
  }

  return count;
}

function getLineStartOffsets(code: string): number[] {
  const offsets = [0];
  for (let index = 0; index < code.length; index++) {
    if (code[index] === '\n') {
      offsets.push(index + 1);
    }
  }

  return offsets;
}

function indexToLinePosition(code: string, index: number): { lineNumber: number; column: number } {
  const clampedIndex = Math.max(0, Math.min(index, code.length));
  const starts = getLineStartOffsets(code);

  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = starts[mid] ?? 0;
    const nextStart = starts[mid + 1] ?? Number.POSITIVE_INFINITY;

    if (clampedIndex < start) {
      high = mid - 1;
      continue;
    }

    if (clampedIndex >= nextStart) {
      low = mid + 1;
      continue;
    }

    return {
      lineNumber: mid + 1,
      column: clampedIndex - start,
    };
  }

  const fallbackLine = starts.length;
  const fallbackStart = starts[fallbackLine - 1] ?? 0;
  return {
    lineNumber: fallbackLine,
    column: clampedIndex - fallbackStart,
  };
}

function findFullyDeletedLines(code: string, startIndex: number, endIndex: number): Set<number> {
  const starts = getLineStartOffsets(code);
  const fullyDeleted = new Set<number>();

  for (let lineIndex = 0; lineIndex < starts.length; lineIndex++) {
    const lineStart = starts[lineIndex] ?? 0;
    const lineEnd = starts[lineIndex + 1] ?? code.length;

    if (lineStart >= startIndex && lineEnd <= endIndex) {
      fullyDeleted.add(lineIndex + 1);
    }
  }

  return fullyDeleted;
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
