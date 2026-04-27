import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { YjsDocumentStore } from './yjs-document-store.js';

describe('YjsDocumentStore', () => {
  describe('createDoc', () => {
    it('GIVEN no existing doc WHEN creating THEN returns a Y.Doc with created=true', () => {
      const store = new YjsDocumentStore();
      const { doc, created } = store.createDoc('room-1');

      expect(doc).toBeInstanceOf(Y.Doc);
      expect(created).toBe(true);
    });

    it('GIVEN initialContentByLanguage WHEN creating THEN each language Y.Text has its seed', () => {
      const store = new YjsDocumentStore();
      const { doc } = store.createDoc('room-1', {
        initialContentByLanguage: {
          python: '# py starter',
          javascript: '// js starter',
        },
      });

      expect(doc.getText('code:python').toString()).toBe('# py starter');
      expect(doc.getText('code:javascript').toString()).toBe('// js starter');
    });

    it('GIVEN no initialContentByLanguage WHEN creating THEN all language Y.Texts are empty', () => {
      const store = new YjsDocumentStore();
      const { doc } = store.createDoc('room-1');

      expect(doc.getText('code:python').toString()).toBe('');
      expect(doc.getText('code:javascript').toString()).toBe('');
    });

    it('GIVEN snapshot WHEN creating THEN the doc state matches the snapshot content', () => {
      const seed = new Y.Doc();
      seed.getText('code').insert(0, 'from-snapshot');
      const snapshot = Y.encodeStateAsUpdate(seed);
      seed.destroy();

      const store = new YjsDocumentStore();
      const { doc, created } = store.createDoc('room-1', { snapshot });

      expect(created).toBe(true);
      expect(doc.getText('code').toString()).toBe('from-snapshot');
    });

    it('GIVEN both snapshot and initialContentByLanguage WHEN creating THEN snapshot takes precedence', () => {
      const seed = new Y.Doc();
      seed.getText('code:python').insert(0, 'from-snapshot');
      const snapshot = Y.encodeStateAsUpdate(seed);
      seed.destroy();

      const store = new YjsDocumentStore();
      const { doc } = store.createDoc('room-1', {
        snapshot,
        initialContentByLanguage: { python: 'starter' },
      });

      expect(doc.getText('code:python').toString()).toBe('from-snapshot');
    });

    it('GIVEN corrupt snapshot WHEN creating THEN does not throw and returns a usable Y.Doc', () => {
      const store = new YjsDocumentStore();
      const corrupt = new Uint8Array([0xff, 0x00]);

      const result = store.createDoc('room-1', { snapshot: corrupt });

      expect(result.created).toBe(true);
      expect(result.doc).toBeInstanceOf(Y.Doc);
      // doc is still usable
      result.doc.getText('code').insert(0, 'after-recovery');
      expect(result.doc.getText('code').toString()).toBe('after-recovery');
    });

    it('GIVEN corrupt snapshot with initialContentByLanguage WHEN creating THEN seeds the starter content', () => {
      const store = new YjsDocumentStore();
      const corrupt = new Uint8Array([0xff, 0x00]);

      const { doc, created } = store.createDoc('room-1', {
        snapshot: corrupt,
        initialContentByLanguage: { python: 'fallback-starter' },
      });

      expect(created).toBe(true);
      expect(doc.getText('code:python').toString()).toBe('fallback-starter');
    });

    it('GIVEN existing doc WHEN creating duplicate THEN returns existing doc with created=false', () => {
      const store = new YjsDocumentStore();
      const first = store.createDoc('room-1', {
        initialContentByLanguage: { python: 'first' },
      });

      const second = store.createDoc('room-1', {
        initialContentByLanguage: { python: 'second' },
      });

      expect(second.created).toBe(false);
      expect(second.doc).toBe(first.doc);
      expect(second.doc.getText('code:python').toString()).toBe('first');
    });
  });

  describe('getDoc', () => {
    it('GIVEN existing doc WHEN getting THEN returns the doc', () => {
      const store = new YjsDocumentStore();
      const { doc } = store.createDoc('room-1');

      expect(store.getDoc('room-1')).toBe(doc);
    });

    it('GIVEN non-existent room WHEN getting THEN returns undefined', () => {
      const store = new YjsDocumentStore();

      expect(store.getDoc('room-1')).toBeUndefined();
    });
  });

  describe('getCodeText', () => {
    it('GIVEN seeded language WHEN getCodeText(roomId, language) THEN returns the corresponding text', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1', {
        initialContentByLanguage: {
          python: 'print("hi")',
          javascript: 'console.log("hi")',
        },
      });

      expect(store.getCodeText('room-1', 'python')).toBe('print("hi")');
      expect(store.getCodeText('room-1', 'javascript')).toBe('console.log("hi")');
    });

    it('GIVEN unseeded language WHEN getCodeText THEN returns empty string', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1');

      expect(store.getCodeText('room-1', 'python')).toBe('');
    });

    it('GIVEN non-existent room WHEN getCodeText THEN returns empty string', () => {
      const store = new YjsDocumentStore();

      expect(store.getCodeText('room-1', 'python')).toBe('');
    });
  });

  describe('destroyDoc', () => {
    it('GIVEN doc with content WHEN destroying THEN returns Uint8Array that can reconstruct the doc', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1', {
        initialContentByLanguage: { python: 'function solve() {}' },
      });

      const snapshot = store.destroyDoc('room-1');

      expect(snapshot).toBeInstanceOf(Uint8Array);

      const reconstructed = new Y.Doc();
      Y.applyUpdate(reconstructed, snapshot!);
      expect(reconstructed.getText('code:python').toString()).toBe('function solve() {}');
      reconstructed.destroy();
    });

    it('GIVEN non-existent room WHEN destroying THEN returns undefined', () => {
      const store = new YjsDocumentStore();

      expect(store.destroyDoc('room-1')).toBeUndefined();
    });

    it('GIVEN destroyed doc WHEN getting THEN returns undefined', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1');
      store.destroyDoc('room-1');

      expect(store.getDoc('room-1')).toBeUndefined();
    });
  });

  describe('encodeSnapshot', () => {
    it('GIVEN existing doc with content WHEN encoding THEN returns Uint8Array that can reconstruct', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1', {
        initialContentByLanguage: { python: 'const x = 42;' },
      });

      const snapshot = store.encodeSnapshot('room-1');

      expect(snapshot).toBeInstanceOf(Uint8Array);

      const reconstructed = new Y.Doc();
      Y.applyUpdate(reconstructed, snapshot!);
      expect(reconstructed.getText('code:python').toString()).toBe('const x = 42;');
      reconstructed.destroy();
    });

    it('GIVEN non-existent room WHEN encoding THEN returns undefined', () => {
      const store = new YjsDocumentStore();

      expect(store.encodeSnapshot('room-1')).toBeUndefined();
    });
  });
});
