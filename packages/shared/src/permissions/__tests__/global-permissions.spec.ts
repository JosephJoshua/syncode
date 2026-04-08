import { describe, expect, test } from 'vitest';
import { UserRole } from '../../types/user';
import {
  ALL_GLOBAL_CAPABILITIES_SET,
  GLOBAL_ROLE_PERMISSIONS,
  getGlobalPermissions,
  hasGlobalPermission,
} from '../global-permissions';

describe('Global Permissions', () => {
  describe('hasGlobalPermission', () => {
    test('GIVEN admin role WHEN checking any capability THEN returns true for all', () => {
      for (const capability of ALL_GLOBAL_CAPABILITIES_SET) {
        expect(hasGlobalPermission(UserRole.ADMIN, capability)).toBe(true);
      }
    });

    test('GIVEN user role WHEN checking room:create THEN returns true', () => {
      expect(hasGlobalPermission(UserRole.USER, 'room:create')).toBe(true);
    });

    test('GIVEN user role WHEN checking user:manage THEN returns false', () => {
      expect(hasGlobalPermission(UserRole.USER, 'user:manage')).toBe(false);
    });

    test('GIVEN user role WHEN checking platform:manage-settings THEN returns false', () => {
      expect(hasGlobalPermission(UserRole.USER, 'platform:manage-settings')).toBe(false);
    });

    test('GIVEN user role WHEN checking user:edit-self THEN returns true', () => {
      expect(hasGlobalPermission(UserRole.USER, 'user:edit-self')).toBe(true);
    });

    test('GIVEN user role WHEN checking room:delete-any THEN returns false', () => {
      expect(hasGlobalPermission(UserRole.USER, 'room:delete-any')).toBe(false);
    });

    test('GIVEN user role WHEN checking room:delete-own THEN returns true', () => {
      expect(hasGlobalPermission(UserRole.USER, 'room:delete-own')).toBe(true);
    });
  });

  describe('getGlobalPermissions', () => {
    test('GIVEN admin role WHEN getting permissions THEN returns all capabilities', () => {
      const perms = getGlobalPermissions(UserRole.ADMIN);
      expect(perms).toBe(ALL_GLOBAL_CAPABILITIES_SET);
    });

    test('GIVEN user role WHEN getting permissions THEN returns limited set', () => {
      const perms = getGlobalPermissions(UserRole.USER);
      expect(perms.size).toBeLessThan(ALL_GLOBAL_CAPABILITIES_SET.size);
      expect(perms.has('room:create')).toBe(true);
      expect(perms.has('room:join')).toBe(true);
      expect(perms.has('room:list')).toBe(true);
      expect(perms.has('session:view-own')).toBe(true);
      expect(perms.has('report:view-own')).toBe(true);
    });

    test('GIVEN user role WHEN getting permissions THEN excludes admin-only capabilities', () => {
      const perms = getGlobalPermissions(UserRole.USER);
      expect(perms.has('user:ban')).toBe(false);
      expect(perms.has('room:force-close')).toBe(false);
      expect(perms.has('session:view-any')).toBe(false);
      expect(perms.has('platform:view-analytics')).toBe(false);
    });
  });

  describe('Role mapping sanity', () => {
    test('GIVEN all roles WHEN checking THEN every role maps to a valid permission set', () => {
      for (const role of Object.values(UserRole)) {
        const perms = GLOBAL_ROLE_PERMISSIONS[role];
        expect(perms).toBeDefined();
        expect(perms.size).toBeGreaterThan(0);
      }
    });

    test('GIVEN admin role WHEN comparing to user role THEN admin has strictly more capabilities', () => {
      const adminPerms = getGlobalPermissions(UserRole.ADMIN);
      const userPerms = getGlobalPermissions(UserRole.USER);
      expect(adminPerms.size).toBeGreaterThan(userPerms.size);
      for (const cap of userPerms) {
        expect(adminPerms.has(cap)).toBe(true);
      }
    });
  });
});
