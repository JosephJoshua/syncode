import { describe, expect, test } from 'vitest';
import { RoomRole } from '../../types/room';
import {
  getRoomPermissions,
  HOST_OVERRIDE_CAPABILITIES,
  hasResolvedRoomPermission,
  hasRoomPermission,
  ROOM_ROLE_PERMISSIONS,
  resolveRoomPermissions,
} from '../room-permissions';

describe('Room Permissions', () => {
  describe('hasRoomPermission', () => {
    test('GIVEN observer role WHEN checking code:edit THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.OBSERVER, 'code:edit')).toBe(false);
    });

    test('GIVEN observer role WHEN checking code:view THEN returns true', () => {
      expect(hasRoomPermission(RoomRole.OBSERVER, 'code:view')).toBe(true);
    });

    test('GIVEN candidate role WHEN checking room:change-phase THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.CANDIDATE, 'room:change-phase')).toBe(false);
    });

    test('GIVEN interviewer role WHEN checking room:change-phase THEN returns true', () => {
      expect(hasRoomPermission(RoomRole.INTERVIEWER, 'room:change-phase')).toBe(true);
    });

    test('GIVEN interviewer role WHEN checking room:select-problem THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.INTERVIEWER, 'room:select-problem')).toBe(false);
    });

    test('GIVEN interviewer role WHEN checking recording:toggle THEN returns false', () => {
      expect(hasRoomPermission(RoomRole.INTERVIEWER, 'recording:toggle')).toBe(false);
    });
  });

  describe('resolveRoomPermissions', () => {
    test('GIVEN host interviewer WHEN resolving permissions THEN host-only capabilities are added', () => {
      const interviewerPermissions = getRoomPermissions(RoomRole.INTERVIEWER);
      const resolvedPermissions = resolveRoomPermissions(RoomRole.INTERVIEWER, { isHost: true });

      expect(resolvedPermissions.size).toBeGreaterThan(interviewerPermissions.size);
      for (const capability of HOST_OVERRIDE_CAPABILITIES) {
        expect(resolvedPermissions.has(capability)).toBe(true);
      }
    });

    test('GIVEN non-host candidate WHEN resolving permissions THEN base permissions are returned', () => {
      const permissions = resolveRoomPermissions(RoomRole.CANDIDATE, { isHost: false });
      expect(permissions).toBe(getRoomPermissions(RoomRole.CANDIDATE));
    });

    test('GIVEN host candidate WHEN checking participant:kick THEN returns true', () => {
      expect(
        hasResolvedRoomPermission(RoomRole.CANDIDATE, 'participant:kick', { isHost: true }),
      ).toBe(true);
    });

    test('GIVEN host candidate WHEN checking room:select-problem THEN returns true', () => {
      expect(
        hasResolvedRoomPermission(RoomRole.CANDIDATE, 'room:select-problem', { isHost: true }),
      ).toBe(true);
    });
  });

  describe('Role hierarchy sanity', () => {
    test('GIVEN role hierarchy WHEN comparing THEN interviewer has most base capabilities and observer has fewest', () => {
      const interviewerPermissions = getRoomPermissions(RoomRole.INTERVIEWER);
      const candidatePermissions = getRoomPermissions(RoomRole.CANDIDATE);
      const observerPermissions = getRoomPermissions(RoomRole.OBSERVER);

      expect(interviewerPermissions.size).toBeGreaterThan(candidatePermissions.size);
      expect(candidatePermissions.size).toBeGreaterThan(observerPermissions.size);
    });

    test('GIVEN all roles WHEN checking THEN every role maps to a valid permission set', () => {
      for (const role of Object.values(RoomRole)) {
        const permissions = ROOM_ROLE_PERMISSIONS[role];
        expect(permissions).toBeDefined();
        expect(permissions.size).toBeGreaterThan(0);
      }
    });

    test('GIVEN observer capabilities WHEN checking THEN they are a subset of candidate capabilities', () => {
      const observerPermissions = getRoomPermissions(RoomRole.OBSERVER);
      const candidatePermissions = getRoomPermissions(RoomRole.CANDIDATE);

      for (const capability of observerPermissions) {
        expect(candidatePermissions.has(capability)).toBe(true);
      }
    });
  });
});
