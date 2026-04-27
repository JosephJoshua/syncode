import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { INLINE_COMMENTS_KEY } from '@syncode/shared';
import * as Y from 'yjs';

export interface CreateDocOptions {
  initialContentByLanguage?: Record<string, string>;
  snapshot?: Uint8Array;
}

export interface CreateDocResult {
  doc: Y.Doc;
  created: boolean;
}

@Injectable()
export class YjsDocumentStore implements OnModuleDestroy {
  private readonly logger = new Logger(YjsDocumentStore.name);
  private readonly docs = new Map<string, Y.Doc>();

  private static codeKey(language: string): string {
    return `code:${language}`;
  }

  private static seedDoc(doc: Y.Doc, seeds: Record<string, string> | undefined): void {
    if (!seeds) return;
    for (const [language, content] of Object.entries(seeds)) {
      if (content && content.length > 0) {
        doc.getText(YjsDocumentStore.codeKey(language)).insert(0, content);
      }
    }
  }

  createDoc(roomId: string, options: CreateDocOptions = {}): CreateDocResult {
    const existing = this.docs.get(roomId);
    if (existing) {
      return { doc: existing, created: false };
    }

    const doc = new Y.Doc();
    let snapshotApplied = false;

    if (options.snapshot) {
      try {
        Y.applyUpdate(doc, options.snapshot);
        snapshotApplied = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to apply snapshot for room ${roomId} (${options.snapshot.byteLength} bytes): ${message}. Falling back to empty doc with starter content.`,
        );
        doc.destroy();
        const fresh = new Y.Doc();
        YjsDocumentStore.seedDoc(fresh, options.initialContentByLanguage);
        this.docs.set(roomId, fresh);
        this.logger.log(`Y.Doc created for room ${roomId}`);
        return { doc: fresh, created: true };
      }
    }

    if (!snapshotApplied) {
      YjsDocumentStore.seedDoc(doc, options.initialContentByLanguage);
    }

    // Initialize the comments map so every room snapshot has a stable CRDT root
    // for inline discussions even before the first comment is created.
    doc.getMap(INLINE_COMMENTS_KEY);

    this.docs.set(roomId, doc);
    this.logger.log(`Y.Doc created for room ${roomId}`);
    return { doc, created: true };
  }

  getDoc(roomId: string): Y.Doc | undefined {
    return this.docs.get(roomId);
  }

  destroyDoc(roomId: string): Uint8Array | undefined {
    const doc = this.docs.get(roomId);
    if (!doc) {
      return undefined;
    }

    const snapshot = Y.encodeStateAsUpdate(doc);
    doc.destroy();
    this.docs.delete(roomId);

    this.logger.log(`Y.Doc destroyed for room ${roomId}`);
    return snapshot;
  }

  getCodeText(roomId: string, language: string): string {
    const yText = this.docs.get(roomId)?.getText(YjsDocumentStore.codeKey(language));
    return yText ? yText.toJSON() : '';
  }

  encodeSnapshot(roomId: string): Uint8Array | undefined {
    const doc = this.docs.get(roomId);
    if (!doc) {
      return undefined;
    }

    return Y.encodeStateAsUpdate(doc);
  }

  onModuleDestroy(): void {
    for (const [roomId, doc] of this.docs) {
      doc.destroy();
      this.logger.debug(`Y.Doc destroyed for room ${roomId} (shutdown)`);
    }
    this.docs.clear();
  }
}
