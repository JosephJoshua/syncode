import { describe, expect, test } from 'vitest';
import { RoomRole } from '../../types/room';
import {
  ALL_ROOM_CAPABILITIES_SET,
  getRoomPermissions,
  hasRoomPermission,
  ROOM_ROLE_PERMISSIONS,
} from '../room-permissions';

describe('Room Permissions', () => {
  describe('hasRoomPermission', () => {
    test('GIVEN host role WHEN checking any capability THEN returns true for all', () => {
      for (const capability of ALL_ROOM_CAPABILITIES_SET) {
        expect(hasRoomPermission(RoomRole.HOST, capability)).toBe(true);
      }
    });

    test('GIVEN spectator role WHEN checking code:edit THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.SPECTATOR, 'code:edit')).toBe(false);
    });

    test('GIVEN spectator role WHEN checking code:view THEN returns true', () => {
      expect(hasRoomPermission(RoomRole.SPECTATOR, 'code:view')).toBe(true);
    });

    test('GIVEN candidate role WHEN checking room:change-phase THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.CANDIDATE, 'room:change-phase')).toBe(false);
    });

    test('GIVEN interviewer role WHEN checking room:change-phase THEN returns true', () => {
      expect(hasRoomPermission(RoomRole.INTERVIEWER, 'room:change-phase')).toBe(true);
    });

    test('GIVEN candidate role WHEN checking ai:request-review THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.CANDIDATE, 'ai:request-review')).toBe(false);
    });

    test('GIVEN interviewer role WHEN checking participant:kick THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.INTERVIEWER, 'participant:kick')).toBe(false);
    });

    test('GIVEN host role WHEN checking participant:kick THEN returns true', () => {
      expect(hasRoomPermission(RoomRole.HOST, 'participant:kick')).toBe(true);
    });
  });

  describe('getRoomPermissions', () => {
    test('GIVEN host role WHEN getting permissions THEN returns all capabilities', () => {
      const perms = getRoomPermissions(RoomRole.HOST);
      expect(perms).toBe(ALL_ROOM_CAPABILITIES_SET);
    });

    test('GIVEN spectator role WHEN getting permissions THEN returns limited set', () => {
      const perms = getRoomPermissions(RoomRole.SPECTATOR);
      expect(perms.size).toBe(4);
      expect(perms.has('code:view')).toBe(true);
      expect(perms.has('whiteboard:view')).toBe(true);
      expect(perms.has('chat:send')).toBe(true);
      expect(perms.has('recording:replay')).toBe(true);
    });

    test('GIVEN candidate role WHEN getting permissions THEN includes code execution but not room management', () => {
      const perms = getRoomPermissions(RoomRole.CANDIDATE);
      expect(perms.has('code:run')).toBe(true);
      expect(perms.has('code:submit')).toBe(true);
      expect(perms.has('room:settings')).toBe(false);
      expect(perms.has('participant:kick')).toBe(false);
    });
  });

  describe('Role hierarchy sanity', () => {
    test('GIVEN role hierarchy WHEN comparing THEN host has most capabilities and spectator has fewest', () => {
      const hostPerms = getRoomPermissions(RoomRole.HOST);
      const interviewerPerms = getRoomPermissions(RoomRole.INTERVIEWER);
      const candidatePerms = getRoomPermissions(RoomRole.CANDIDATE);
      const spectatorPerms = getRoomPermissions(RoomRole.SPECTATOR);

      expect(hostPerms.size).toBeGreaterThan(interviewerPerms.size);
      expect(interviewerPerms.size).toBeGreaterThan(candidatePerms.size);
      expect(candidatePerms.size).toBeGreaterThan(spectatorPerms.size);
    });

    test('GIVEN all roles WHEN checking THEN every role maps to a valid permission set', () => {
      for (const role of Object.values(RoomRole)) {
        const perms = ROOM_ROLE_PERMISSIONS[role];
        expect(perms).toBeDefined();
        expect(perms.size).toBeGreaterThan(0);
      }
    });

    test('GIVEN spectator capabilities WHEN checking THEN they are a subset of candidate capabilities', () => {
      const spectator = getRoomPermissions(RoomRole.SPECTATOR);
      const candidate = getRoomPermissions(RoomRole.CANDIDATE);
      for (const cap of spectator) {
        expect(candidate.has(cap)).toBe(true);
      }
    });
  });
});
