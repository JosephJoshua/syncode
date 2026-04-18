import { ConflictException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';

export interface CreateDocOptions {
  initialContentByLanguage?: Record<string, string>;
}

@Injectable()
export class YjsDocumentStore implements OnModuleDestroy {
  private readonly logger = new Logger(YjsDocumentStore.name);
  private readonly docs = new Map<string, Y.Doc>();

  private static codeKey(language: string): string {
    return `code:${language}`;
  }

  createDoc(roomId: string, options?: CreateDocOptions): Y.Doc {
    if (this.docs.has(roomId)) {
      throw new ConflictException(`Room ${roomId} already exists`);
    }

    const doc = new Y.Doc();

    const seeds = options?.initialContentByLanguage;
    if (seeds) {
      for (const [language, content] of Object.entries(seeds)) {
        if (content && content.length > 0) {
          doc.getText(YjsDocumentStore.codeKey(language)).insert(0, content);
        }
      }
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

  getCodeText(roomId: string, language: string): string {
    return this.docs.get(roomId)?.getText(YjsDocumentStore.codeKey(language)).toString() ?? '';
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
