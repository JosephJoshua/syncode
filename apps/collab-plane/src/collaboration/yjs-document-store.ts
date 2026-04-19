import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';

export interface CreateDocOptions {
  initialContent?: string;
  snapshot?: Uint8Array;
}

export interface CreateDocResult {
  doc: Y.Doc;
  created: boolean;
}

@Injectable()
export class YjsDocumentStore implements OnModuleDestroy {
  private static readonly CODE_KEY = 'code';

  private readonly logger = new Logger(YjsDocumentStore.name);
  private readonly docs = new Map<string, Y.Doc>();

  createDoc(roomId: string, options: CreateDocOptions = {}): CreateDocResult {
    const existing = this.docs.get(roomId);
    if (existing) {
      return { doc: existing, created: false };
    }

    const doc = new Y.Doc();

    if (options.snapshot) {
      Y.applyUpdate(doc, options.snapshot);
    } else if (options.initialContent) {
      doc.getText(YjsDocumentStore.CODE_KEY).insert(0, options.initialContent);
    }

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

  getCodeText(roomId: string): string {
    return this.docs.get(roomId)?.getText(YjsDocumentStore.CODE_KEY).toString() ?? '';
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
