import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';

@Injectable()
export class YjsDocumentStore {
  private readonly logger = new Logger(YjsDocumentStore.name);
  private readonly docs = new Map<string, Y.Doc>();

  createDoc(roomId: string, initialContent?: string): Y.Doc {
    if (this.docs.has(roomId)) {
      throw new ConflictException(`Room ${roomId} already exists`);
    }

    const doc = new Y.Doc();

    if (initialContent) {
      doc.getText('code').insert(0, initialContent);
    }

    this.docs.set(roomId, doc);
    this.logger.log(`Y.Doc created for room ${roomId}`);
    return doc;
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

  encodeSnapshot(roomId: string): Uint8Array | undefined {
    const doc = this.docs.get(roomId);
    if (!doc) {
      return undefined;
    }

    return Y.encodeStateAsUpdate(doc);
  }
}
