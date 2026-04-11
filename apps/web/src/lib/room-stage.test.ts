import { describe, expect, it } from 'vitest';
import {
  computeRoomElapsedMs,
  countActiveRoleConfiguration,
  isPeerRoleConfigurationValid,
} from './room-stage.js';

describe('computeRoomElapsedMs', () => {
  it('adds live elapsed time only while coding is running', () => {
    expect(
      computeRoomElapsedMs({
        status: 'coding',
        elapsedMs: 15_000,
        currentPhaseStartedAt: '2026-04-11T12:00:00.000Z',
        timerPaused: false,
        now: new Date('2026-04-11T12:00:05.000Z').getTime(),
      }),
    ).toBe(20_000);
  });

  it('returns stored elapsed time when the coding timer is paused', () => {
    expect(
      computeRoomElapsedMs({
        status: 'coding',
        elapsedMs: 15_000,
        currentPhaseStartedAt: '2026-04-11T12:00:00.000Z',
        timerPaused: true,
        now: new Date('2026-04-11T12:00:05.000Z').getTime(),
      }),
    ).toBe(15_000);
  });
});

describe('countActiveRoleConfiguration', () => {
  it('ignores inactive participants when summarizing room roles', () => {
    expect(
      countActiveRoleConfiguration([
        { role: 'interviewer', isActive: true },
        { role: 'candidate', isActive: true },
        { role: 'observer', isActive: true },
        { role: 'candidate', isActive: false },
      ]),
    ).toEqual({
      activeCount: 3,
      interviewerCount: 1,
      candidateCount: 1,
      observerCount: 1,
    });
  });
});

describe('isPeerRoleConfigurationValid', () => {
  it('requires exactly one active interviewer and one active candidate', () => {
    expect(
      isPeerRoleConfigurationValid([
        { role: 'interviewer', isActive: true },
        { role: 'candidate', isActive: true },
        { role: 'observer', isActive: true },
      ]),
    ).toBe(true);

    expect(
      isPeerRoleConfigurationValid([
        { role: 'interviewer', isActive: true },
        { role: 'interviewer', isActive: true },
        { role: 'candidate', isActive: true },
      ]),
    ).toBe(false);
  });
});
