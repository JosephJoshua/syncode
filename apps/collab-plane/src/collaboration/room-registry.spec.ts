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
      expect(registry.hasRoom('room-1')).toBe(true);
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
