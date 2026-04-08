import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { YjsDocumentStore } from './yjs-document-store.js';

describe('YjsDocumentStore', () => {
  describe('createDoc', () => {
    it('GIVEN no existing doc WHEN creating THEN returns a Y.Doc', () => {
      const store = new YjsDocumentStore();
      const doc = store.createDoc('room-1');

      expect(doc).toBeInstanceOf(Y.Doc);
    });

    it('GIVEN initialContent WHEN creating THEN Y.Text("code") contains the content', () => {
      const store = new YjsDocumentStore();
      const doc = store.createDoc('room-1', 'console.log("hello")');

      expect(doc.getText('code').toString()).toBe('console.log("hello")');
    });

    it('GIVEN existing doc WHEN creating duplicate THEN throws ConflictException', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1');

      expect(() => store.createDoc('room-1')).toThrow(ConflictException);
    });
  });

  describe('getDoc', () => {
    it('GIVEN existing doc WHEN getting THEN returns the doc', () => {
      const store = new YjsDocumentStore();
      const created = store.createDoc('room-1');

      expect(store.getDoc('room-1')).toBe(created);
    });

    it('GIVEN non-existent room WHEN getting THEN returns undefined', () => {
      const store = new YjsDocumentStore();

      expect(store.getDoc('room-1')).toBeUndefined();
    });
  });

  describe('destroyDoc', () => {
    it('GIVEN doc with content WHEN destroying THEN returns Uint8Array that can reconstruct the doc', () => {
      const store = new YjsDocumentStore();
      store.createDoc('room-1', 'function solve() {}');

      const snapshot = store.destroyDoc('room-1');

      expect(snapshot).toBeInstanceOf(Uint8Array);

      // Verify the snapshot can reconstruct the document.
      const reconstructed = new Y.Doc();
      Y.applyUpdate(reconstructed, snapshot!);
      expect(reconstructed.getText('code').toString()).toBe('function solve() {}');
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
      store.createDoc('room-1', 'const x = 42;');

      const snapshot = store.encodeSnapshot('room-1');

      expect(snapshot).toBeInstanceOf(Uint8Array);

      // Verify the snapshot can reconstruct the document.
      const reconstructed = new Y.Doc();
      Y.applyUpdate(reconstructed, snapshot!);
      expect(reconstructed.getText('code').toString()).toBe('const x = 42;');
      reconstructed.destroy();
    });

    it('GIVEN non-existent room WHEN encoding THEN returns undefined', () => {
      const store = new YjsDocumentStore();

      expect(store.encodeSnapshot('room-1')).toBeUndefined();
    });
  });
});
