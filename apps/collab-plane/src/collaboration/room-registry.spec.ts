import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedClient } from '../auth/index.js';
import { RoomRegistry } from './room-registry.js';

function fakeClient(userId: string): AuthenticatedClient {
  return {
    user: { sub: userId, roomId: 'room-1', role: 'candidate', type: 'collab', iat: 0, exp: 0 },
    close: () => {},
    send: () => {},
  } as unknown as AuthenticatedClient;
}

describe('RoomRegistry', () => {
  describe('createRoom', () => {
    it('GIVEN no existing room WHEN creating THEN room is created and returned', () => {
      const registry = new RoomRegistry();
      const room = registry.createRoom('room-1');

      expect(room.roomId).toBe('room-1');
      expect(room.createdAt).toBeGreaterThan(0);
      expect(room.clients.size).toBe(0);
      expect(room.language).toBeNull();
      expect(registry.hasRoom('room-1')).toBe(true);
    });

    it('GIVEN language option WHEN creating THEN room reflects the active language', () => {
      const registry = new RoomRegistry();
      const room = registry.createRoom('room-1', { language: 'python' });

      expect(room.language).toBe('python');
    });

    it('GIVEN existing room WHEN creating duplicate THEN throws ConflictException', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');

      expect(() => registry.createRoom('room-1')).toThrow(ConflictException);
    });
  });

  describe('addClient', () => {
    it('GIVEN existing room WHEN adding client THEN client is registered', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');
      const client = fakeClient('user-1');

      registry.addClient('room-1', 'user-1', client);

      expect(registry.hasClient('room-1', 'user-1')).toBe(true);
      expect(registry.getClient('room-1', 'user-1')).toBe(client);
    });

    it('GIVEN duplicate userId WHEN adding client THEN throws ConflictException', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');
      registry.addClient('room-1', 'user-1', fakeClient('user-1'));

      expect(() => registry.addClient('room-1', 'user-1', fakeClient('user-1'))).toThrow(
        ConflictException,
      );
    });

    it('GIVEN non-existent room WHEN adding client THEN throws NotFoundException', () => {
      const registry = new RoomRegistry();
      const client = fakeClient('user-1');

      expect(() => registry.addClient('room-1', 'user-1', client)).toThrow(NotFoundException);
    });
  });

  describe('removeClient', () => {
    it('GIVEN registered client WHEN removing THEN returns true', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');
      registry.addClient('room-1', 'user-1', fakeClient('user-1'));

      expect(registry.removeClient('room-1', 'user-1')).toBe(true);
      expect(registry.hasClient('room-1', 'user-1')).toBe(false);
    });

    it('GIVEN non-existent client WHEN removing THEN returns false', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');

      expect(registry.removeClient('room-1', 'user-1')).toBe(false);
    });

    it('GIVEN non-existent room WHEN removing client THEN returns false', () => {
      const registry = new RoomRegistry();

      expect(registry.removeClient('room-1', 'user-1')).toBe(false);
    });
  });

  describe('updateRoomState', () => {
    it('GIVEN existing room WHEN updating state THEN returns updated room and previous values', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1', { phase: 'waiting', editorLocked: false });

      const result = registry.updateRoomState('room-1', {
        phase: 'coding',
        editorLocked: true,
      });

      expect(result.room.phase).toBe('coding');
      expect(result.room.editorLocked).toBe(true);
      expect(result.previousPhase).toBe('waiting');
      expect(result.previousEditorLocked).toBe(false);
    });

    it('GIVEN non-existent room WHEN updating state THEN throws NotFoundException', () => {
      const registry = new RoomRegistry();

      expect(() =>
        registry.updateRoomState('room-1', { phase: 'coding', editorLocked: false }),
      ).toThrow(NotFoundException);
    });
  });

  describe('updateLanguage', () => {
    it('GIVEN existing room WHEN updating language THEN registry reflects new language', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1', { language: 'python' });

      registry.updateLanguage('room-1', 'javascript');

      expect(registry.getRoom('room-1')?.language).toBe('javascript');
    });

    it('GIVEN room without initial language WHEN updating language THEN language is set', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');

      registry.updateLanguage('room-1', 'python');

      expect(registry.getRoom('room-1')?.language).toBe('python');
    });

    it('GIVEN non-existent room WHEN updating language THEN throws NotFoundException', () => {
      const registry = new RoomRegistry();

      expect(() => registry.updateLanguage('room-1', 'python')).toThrow(NotFoundException);
    });
  });

  describe('deleteRoom', () => {
    it('GIVEN existing room WHEN deleting THEN returns true and room is gone', () => {
      const registry = new RoomRegistry();
      registry.createRoom('room-1');

      expect(registry.deleteRoom('room-1')).toBe(true);
      expect(registry.hasRoom('room-1')).toBe(false);
    });

    it('GIVEN non-existent room WHEN deleting THEN returns false', () => {
      const registry = new RoomRegistry();

      expect(registry.deleteRoom('room-1')).toBe(false);
    });
  });
});
