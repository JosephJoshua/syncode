import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('WHEN checking health THEN returns ok', () => {
    const controller = new HealthController();

    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
