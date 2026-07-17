import { describe, expect, it } from 'vitest';
import {
  getNextStatuses,
  isValidStatusTransition,
  ROOM_STATUS_LABELS,
  ROOM_STATUSES,
  RoomStatus,
} from '../room.js';

describe('getNextStatuses', () => {
  it('GIVEN WAITING status WHEN getting next statuses THEN returns WARMUP and FINISHED', () => {
    expect(getNextStatuses(RoomStatus.WAITING)).toEqual([RoomStatus.WARMUP, RoomStatus.FINISHED]);
  });

  it('GIVEN WARMUP status WHEN getting next statuses THEN returns CODING and FINISHED', () => {
    expect(getNextStatuses(RoomStatus.WARMUP)).toEqual([RoomStatus.CODING, RoomStatus.FINISHED]);
  });

  it('GIVEN CODING status WHEN getting next statuses THEN returns WRAPUP and FINISHED', () => {
    expect(getNextStatuses(RoomStatus.CODING)).toEqual([RoomStatus.WRAPUP, RoomStatus.FINISHED]);
  });

  it('GIVEN WRAPUP status WHEN getting next statuses THEN returns only FINISHED', () => {
    expect(getNextStatuses(RoomStatus.WRAPUP)).toEqual([RoomStatus.FINISHED]);
  });

  it('GIVEN FINISHED status WHEN getting next statuses THEN returns empty array', () => {
    expect(getNextStatuses(RoomStatus.FINISHED)).toEqual([]);
  });
});

describe('isValidStatusTransition', () => {
  it('GIVEN each forward transition WHEN validating THEN returns true', () => {
    expect(isValidStatusTransition(RoomStatus.WAITING, RoomStatus.WARMUP)).toBe(true);
    expect(isValidStatusTransition(RoomStatus.WARMUP, RoomStatus.CODING)).toBe(true);
    expect(isValidStatusTransition(RoomStatus.CODING, RoomStatus.WRAPUP)).toBe(true);
    expect(isValidStatusTransition(RoomStatus.WRAPUP, RoomStatus.FINISHED)).toBe(true);
  });

  it('GIVEN backward transition WHEN validating THEN returns false', () => {
    expect(isValidStatusTransition(RoomStatus.CODING, RoomStatus.WARMUP)).toBe(false);
    expect(isValidStatusTransition(RoomStatus.FINISHED, RoomStatus.WAITING)).toBe(false);
  });

  it('GIVEN self-transition WHEN validating THEN returns false', () => {
    expect(isValidStatusTransition(RoomStatus.WAITING, RoomStatus.WAITING)).toBe(false);
    expect(isValidStatusTransition(RoomStatus.FINISHED, RoomStatus.FINISHED)).toBe(false);
  });

  it('GIVEN non-adjacent forward transition WHEN validating THEN returns false', () => {
    expect(isValidStatusTransition(RoomStatus.WAITING, RoomStatus.CODING)).toBe(false);
    expect(isValidStatusTransition(RoomStatus.WARMUP, RoomStatus.WRAPUP)).toBe(false);
  });
});

describe('ROOM_STATUS_LABELS', () => {
  it('GIVEN every room status WHEN reading labels THEN each has a non-empty string', () => {
    for (const status of ROOM_STATUSES) {
      expect(ROOM_STATUS_LABELS[status]).toEqual(expect.any(String));
      expect(ROOM_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});
