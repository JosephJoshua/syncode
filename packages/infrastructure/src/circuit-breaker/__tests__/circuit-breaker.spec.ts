import {
  type CircuitBreakerConfig,
  CircuitBreakerOpenError,
  CircuitBreakerTimeoutError,
  CircuitState,
} from '@syncode/shared';
import { beforeEach, describe, expect, test } from 'vitest';
import { CircuitBreakerAdapter } from '../circuit-breaker.adapter.js';

describe('Circuit Breaker Adapter', () => {
  let circuitBreaker: CircuitBreakerAdapter;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerAdapter();
  });

  describe('Circuit State Transitions from CLOSED to OPEN', () => {
    test('GIVEN circuit is CLOSED WHEN failures reach threshold THEN transitions to OPEN', async () => {
      const failingFn = async () => {
        throw new Error('Service down');
      };
      const config = {
        name: 'test-circuit',
        failureThreshold: 3,
        resetTimeoutMs: 10000,
      };

      // Execute until threshold (3 failures)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow('Service down');
      }

      const stats = circuitBreaker.getStats('test-circuit');
      expect(stats?.state).toBe(CircuitState.OPEN);
      expect(stats?.failureCount).toBe(3);
    });
  });

  describe('Circuit Rejection When OPEN', () => {
    test('GIVEN circuit is OPEN WHEN execute called THEN rejects immediately without calling function', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        throw new Error('fail');
      };
      const config = { name: 'test-circuit', failureThreshold: 2 };

      // Trip circuit
      await expect(circuitBreaker.execute(fn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(fn, config)).rejects.toThrow();
      expect(callCount).toBe(2);

      // Next call should be rejected without calling fn
      await expect(circuitBreaker.execute(fn, config)).rejects.toThrow(CircuitBreakerOpenError);
      expect(callCount).toBe(2); // Not incremented
    });

    test('GIVEN circuit is OPEN WHEN execute called THEN error includes next retry time', async () => {
      const failingFn = async () => {
        throw new Error('fail');
      };
      const config = {
        name: 'test-circuit',
        failureThreshold: 2,
        resetTimeoutMs: 5000,
      };

      // Trip circuit
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();

      // Check error details
      try {
        await circuitBreaker.execute(failingFn, config);
        throw new Error('Should have thrown CircuitBreakerOpenError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        expect((error as CircuitBreakerOpenError).circuitName).toBe('test-circuit');
        expect((error as CircuitBreakerOpenError).nextRetryAt).toBeInstanceOf(Date);

        const nextRetry = (error as CircuitBreakerOpenError).nextRetryAt.getTime();
        const now = Date.now();
        expect(nextRetry).toBeGreaterThan(now);
        expect(nextRetry).toBeLessThanOrEqual(now + 5000);
      }
    });
  });

  describe('OPEN to HALF_OPEN Transition', () => {
    test('GIVEN circuit is OPEN WHEN reset timeout elapses THEN transitions to HALF_OPEN', async () => {
      const failingFn = async () => {
        throw new Error('fail');
      };
      const config = {
        name: 'test-circuit',
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
      };

      // Trip circuit
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();

      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next call should be allowed (HALF_OPEN)
      const successFn = async () => 'success';
      await expect(circuitBreaker.execute(successFn, config)).resolves.toBe('success');

      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.HALF_OPEN);
    });
  });

  describe('HALF_OPEN to CLOSED Transition', () => {
    test('GIVEN circuit is HALF_OPEN WHEN success threshold reached THEN transitions to CLOSED', async () => {
      const failingFn = async () => {
        throw new Error('fail');
      };
      const successFn = async () => 'ok';
      const config = {
        name: 'test-circuit',
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
      };

      // Trip circuit
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();

      // Wait for HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Succeed twice (threshold)
      await circuitBreaker.execute(successFn, config);
      await circuitBreaker.execute(successFn, config);

      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('HALF_OPEN Failure Recovery', () => {
    test('GIVEN circuit is HALF_OPEN WHEN any failure occurs THEN immediately trips back to OPEN', async () => {
      const failingFn = async () => {
        throw new Error('fail');
      };
      const successFn = async () => 'ok';
      const config = {
        name: 'test-circuit',
        failureThreshold: 2,
        resetTimeoutMs: 100,
      };

      // Trip circuit
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();

      // Wait for HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      // One success
      await circuitBreaker.execute(successFn, config);
      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.HALF_OPEN);

      // Then one failure; should immediately trip back to OPEN
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.OPEN);
    });
  });

  describe('Timeout Handling', () => {
    test('GIVEN operation exceeds timeout WHEN execute called THEN throws CircuitBreakerTimeoutError', async () => {
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'too-slow';
      };
      const config = { name: 'test-circuit', operationTimeoutMs: 100 };

      await expect(circuitBreaker.execute(slowFn, config)).rejects.toThrow(
        CircuitBreakerTimeoutError,
      );
    });

    test('GIVEN operation times out WHEN execute called THEN counts as failure', async () => {
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'result';
      };
      const config = {
        name: 'test-circuit',
        failureThreshold: 2,
        operationTimeoutMs: 50,
      };

      // Timeout twice
      await expect(circuitBreaker.execute(slowFn, config)).rejects.toThrow(
        CircuitBreakerTimeoutError,
      );
      await expect(circuitBreaker.execute(slowFn, config)).rejects.toThrow(
        CircuitBreakerTimeoutError,
      );

      // Circuit should be open
      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.getStats('test-circuit')?.totalTimeouts).toBe(2);
    });

    test('GIVEN operation completes before timeout WHEN execute called THEN succeeds', async () => {
      const fastFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };
      const config = { name: 'test-circuit', operationTimeoutMs: 200 };

      await expect(circuitBreaker.execute(fastFn, config)).resolves.toBe('result');
    });
  });

  describe('Stats Tracking', () => {
    test('GIVEN multiple operations WHEN execute called THEN accurately tracks all metrics', async () => {
      const config = { name: 'test-circuit', failureThreshold: 5 };
      const successFn = async () => 'ok';
      const failFn = async () => {
        throw new Error('fail');
      };

      // 3 successes
      await circuitBreaker.execute(successFn, config);
      await circuitBreaker.execute(successFn, config);
      await circuitBreaker.execute(successFn, config);

      // 2 failures
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();

      const stats = circuitBreaker.getStats('test-circuit');
      expect(stats).toMatchObject({
        state: CircuitState.CLOSED,
        totalCalls: 5,
        totalSuccesses: 3,
        totalFailures: 2,
        failureCount: 2,
        totalRejections: 0,
      });
    });

    test('GIVEN circuit is OPEN WHEN requests rejected THEN tracks rejections', async () => {
      const failFn = async () => {
        throw new Error('fail');
      };
      const config = { name: 'test-circuit', failureThreshold: 2 };

      // Trip circuit
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();

      // 3 rejections
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow(CircuitBreakerOpenError);
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow(CircuitBreakerOpenError);
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow(CircuitBreakerOpenError);

      expect(circuitBreaker.getStats('test-circuit')?.totalRejections).toBe(3);
    });
  });

  describe('Multiple Circuits', () => {
    test('GIVEN multiple named circuits WHEN one opens THEN others remain unaffected', async () => {
      const failFn = async () => {
        throw new Error('fail');
      };
      const successFn = async () => 'ok';

      const config1 = { name: 'circuit-1', failureThreshold: 2 };
      const config2 = { name: 'circuit-2', failureThreshold: 2 };

      // Trip circuit-1
      await expect(circuitBreaker.execute(failFn, config1)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn, config1)).rejects.toThrow();

      // circuit-1 should be open
      expect(circuitBreaker.getStats('circuit-1')?.state).toBe(CircuitState.OPEN);

      // circuit-2 should still work
      await expect(circuitBreaker.execute(successFn, config2)).resolves.toBe('ok');
      expect(circuitBreaker.getStats('circuit-2')?.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('Manual Reset', () => {
    test('GIVEN circuit is OPEN WHEN reset called THEN transitions to CLOSED', async () => {
      const failFn = async () => {
        throw new Error('fail');
      };
      const config = { name: 'test-circuit', failureThreshold: 2 };

      // Trip circuit
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();
      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.OPEN);

      // Manual reset
      circuitBreaker.reset('test-circuit');

      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStats('test-circuit')?.failureCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('GIVEN config without name WHEN execute called THEN throws error', async () => {
      const fn = async () => 'result';

      await expect(circuitBreaker.execute(fn, {} as Partial<CircuitBreakerConfig>)).rejects.toThrow(
        'Circuit breaker config must include a name',
      );
    });

    test('GIVEN too many unique circuit names WHEN execute called THEN throws limit error', async () => {
      const fn = async () => 'result';

      // Create circuits up to the limit (100)
      for (let i = 0; i < 100; i++) {
        await circuitBreaker.execute(fn, { name: `circuit-${i}` });
      }

      // Next circuit should fail
      await expect(circuitBreaker.execute(fn, { name: 'circuit-101' })).rejects.toThrow(
        'Circuit limit reached (100)',
      );
    });

    test('GIVEN circuit in CLOSED state WHEN success occurs THEN resets failure count', async () => {
      const failFn = async () => {
        throw new Error('fail');
      };
      const successFn = async () => 'ok';
      const config = { name: 'test-circuit', failureThreshold: 5 };

      // 2 failures
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failFn, config)).rejects.toThrow();
      expect(circuitBreaker.getStats('test-circuit')?.failureCount).toBe(2);

      // 1 success should reset failure count
      await circuitBreaker.execute(successFn, config);
      expect(circuitBreaker.getStats('test-circuit')?.failureCount).toBe(0);
    });
  });

  describe('Config Validation', () => {
    test('GIVEN negative failureThreshold WHEN execute called THEN throws validation error', async () => {
      const fn = async () => 'result';

      await expect(
        circuitBreaker.execute(fn, { name: 'test', failureThreshold: -1 }),
      ).rejects.toThrow('Invalid failureThreshold: -1. Must be positive.');
    });

    test('GIVEN zero resetTimeoutMs WHEN execute called THEN throws validation error', async () => {
      const fn = async () => 'result';

      await expect(circuitBreaker.execute(fn, { name: 'test', resetTimeoutMs: 0 })).rejects.toThrow(
        'Invalid resetTimeoutMs: 0. Must be positive.',
      );
    });

    test('GIVEN negative successThreshold WHEN execute called THEN throws validation error', async () => {
      const fn = async () => 'result';

      await expect(
        circuitBreaker.execute(fn, { name: 'test', successThreshold: -2 }),
      ).rejects.toThrow('Invalid successThreshold: -2. Must be positive.');
    });

    test('GIVEN zero operationTimeoutMs WHEN execute called THEN throws validation error', async () => {
      const fn = async () => 'result';

      await expect(
        circuitBreaker.execute(fn, { name: 'test', operationTimeoutMs: 0 }),
      ).rejects.toThrow('Invalid operationTimeoutMs: 0. Must be positive.');
    });
  });

  describe('Concurrent Access', () => {
    test('GIVEN circuit is OPEN and reset timeout elapsed WHEN multiple requests dispatched concurrently THEN all are allowed through (no probe guard)', async () => {
      // NOTE: This tests current behavior. canExecute() has no probeInFlight guard,
      // so all concurrent calls pass through in HALF_OPEN. In JS single-threaded execution,
      // all canExecute() calls resolve synchronously before any await point, so this test
      // cannot expose a true race condition. If a probeInFlight guard is added later,
      // this test should be updated to assert that only one probe is allowed.
      const failingFn = async () => {
        throw new Error('fail');
      };
      const successFn = async () => 'ok';
      const config = {
        name: 'test-circuit',
        failureThreshold: 2,
        successThreshold: 2,
        resetTimeoutMs: 100,
      };

      // Trip circuit
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn, config)).rejects.toThrow();
      expect(circuitBreaker.getStats('test-circuit')?.state).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // All 10 calls pass through; no probe guard limits concurrency in HALF_OPEN
      const promises = Array.from({ length: 10 }, () => circuitBreaker.execute(successFn, config));

      const results = await Promise.allSettled(promises);
      const successes = results.filter((r) => r.status === 'fulfilled').length;

      expect(successes).toBe(10);

      // Circuit recovers to CLOSED (successThreshold met) or stays HALF_OPEN
      const finalState = circuitBreaker.getStats('test-circuit')?.state;
      expect(finalState).not.toBe(CircuitState.OPEN);
    });
  });
});
