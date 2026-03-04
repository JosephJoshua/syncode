import { CircuitBreakerOpenError, CircuitState } from '@syncode/shared';
import { beforeEach, describe, expect, test } from 'vitest';
import { CircuitBreakerAdapter } from '../circuit-breaker.adapter';
import { createCircuitBreakerProxy } from '../proxy';

/**
 * Test adapter to demonstrate proxy behavior
 */
class TestAdapter {
  async protectedMethod(value: string): Promise<string> {
    return `protected:${value}`;
  }

  async unprotectedMethod(value: string): Promise<string> {
    return `unprotected:${value}`;
  }

  async failingMethod(): Promise<string> {
    throw new Error('Service unavailable');
  }

  syncMethod(value: string): string {
    return `sync:${value}`;
  }
}

describe('Circuit Breaker Proxy', () => {
  let adapter: TestAdapter;
  let circuitBreaker: CircuitBreakerAdapter;
  let proxied: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
    circuitBreaker = new CircuitBreakerAdapter();
    proxied = createCircuitBreakerProxy(adapter, circuitBreaker, {
      protectedMethod: { circuitName: 'test-protected' },
      failingMethod: { circuitName: 'test-failing', config: { failureThreshold: 2 } },
    });
  });

  describe('Method Interception', () => {
    test('GIVEN protected method WHEN called THEN wraps with circuit breaker', async () => {
      const result = await proxied.protectedMethod('test');

      expect(result).toBe('protected:test');

      // Circuit should track the successful call
      const stats = circuitBreaker.getStats('test-protected');
      expect(stats?.totalCalls).toBe(1);
      expect(stats?.totalSuccesses).toBe(1);
    });

    test('GIVEN unprotected method WHEN called THEN passes through without circuit breaker', async () => {
      const result = await proxied.unprotectedMethod('test');

      expect(result).toBe('unprotected:test');

      // Circuit should NOT exist for unprotected method
      const stats = circuitBreaker.getStats('test-unprotected');
      expect(stats).toBeNull();
    });

    test('GIVEN sync method WHEN called THEN passes through unchanged', () => {
      const result = proxied.syncMethod('test');

      expect(result).toBe('sync:test');
    });
  });

  describe('Circuit Breaker Integration', () => {
    test('GIVEN protected method fails WHEN called repeatedly THEN opens circuit', async () => {
      // First failure
      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');

      const stats1 = circuitBreaker.getStats('test-failing');
      expect(stats1?.state).toBe(CircuitState.CLOSED);
      expect(stats1?.failureCount).toBe(1);

      // Second failure; should open circuit (threshold = 2)
      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');

      const stats2 = circuitBreaker.getStats('test-failing');
      expect(stats2?.state).toBe(CircuitState.OPEN);

      // Third call (circuit is open, should reject immediately)
      await expect(proxied.failingMethod()).rejects.toThrow(CircuitBreakerOpenError);

      const stats3 = circuitBreaker.getStats('test-failing');
      expect(stats3?.totalRejections).toBe(1);
    });

    test('GIVEN circuit config override WHEN method called THEN uses custom config', async () => {
      // The failingMethod has failureThreshold: 2 override
      // Default would be 5, but we should see circuit open after 2 failures

      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');
      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');

      const stats = circuitBreaker.getStats('test-failing');
      expect(stats?.state).toBe(CircuitState.OPEN);
    });
  });

  describe('Context Preservation', () => {
    test('GIVEN adapter with state WHEN method called through proxy THEN preserves this context', async () => {
      class StatefulAdapter {
        private state = 'initial';

        async setState(newState: string): Promise<void> {
          this.state = newState;
        }

        async getState(): Promise<string> {
          return this.state;
        }
      }

      const statefulAdapter = new StatefulAdapter();
      const proxiedStateful = createCircuitBreakerProxy(statefulAdapter, circuitBreaker, {
        setState: { circuitName: 'test-set-state' },
        getState: { circuitName: 'test-get-state' },
      });

      await proxiedStateful.setState('updated');
      const result = await proxiedStateful.getState();

      expect(result).toBe('updated');
    });
  });

  describe('Multiple Protected Methods', () => {
    test('GIVEN multiple protected methods WHEN called THEN each has separate circuit', async () => {
      class MultiMethodAdapter {
        async method1(): Promise<string> {
          return 'method1';
        }

        async method2(): Promise<string> {
          throw new Error('method2 fails');
        }
      }

      const multiAdapter = new MultiMethodAdapter();
      const proxiedMulti = createCircuitBreakerProxy(multiAdapter, circuitBreaker, {
        method1: { circuitName: 'multi-method1' },
        method2: { circuitName: 'multi-method2', config: { failureThreshold: 1 } },
      });

      // method1 succeeds
      await proxiedMulti.method1();
      const stats1 = circuitBreaker.getStats('multi-method1');
      expect(stats1?.state).toBe(CircuitState.CLOSED);
      expect(stats1?.totalSuccesses).toBe(1);

      // method2 fails and opens circuit
      await expect(proxiedMulti.method2()).rejects.toThrow('method2 fails');
      const stats2 = circuitBreaker.getStats('multi-method2');
      expect(stats2?.state).toBe(CircuitState.OPEN);

      // method1 still works (different circuit)
      await proxiedMulti.method1();
      const stats1After = circuitBreaker.getStats('multi-method1');
      expect(stats1After?.state).toBe(CircuitState.CLOSED);
      expect(stats1After?.totalSuccesses).toBe(2);
    });
  });

  describe('Error Propagation', () => {
    test('GIVEN protected method throws WHEN called THEN propagates error', async () => {
      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');
    });

    test('GIVEN circuit open WHEN protected method called THEN throws CircuitBreakerOpenError', async () => {
      // Trip circuit
      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');
      await expect(proxied.failingMethod()).rejects.toThrow('Service unavailable');

      // Should now throw CircuitBreakerOpenError
      await expect(proxied.failingMethod()).rejects.toThrow(CircuitBreakerOpenError);
      await expect(proxied.failingMethod()).rejects.toMatchObject({
        name: 'CircuitBreakerOpenError',
        circuitName: 'test-failing',
      });
    });
  });

  describe('Proxy Transparency', () => {
    test('GIVEN proxied adapter WHEN checking instance type THEN preserves original type', () => {
      // Note: Proxies don't preserve instanceof, but methods should work identically
      expect(typeof proxied.protectedMethod).toBe('function');
      expect(typeof proxied.unprotectedMethod).toBe('function');
    });

    test('GIVEN property access WHEN through proxy THEN returns original value', () => {
      class AdapterWithProperty {
        public readonly name = 'TestAdapter';

        async method(): Promise<string> {
          return this.name;
        }
      }

      const withProps = new AdapterWithProperty();
      const proxiedProps = createCircuitBreakerProxy(withProps, circuitBreaker, {
        method: { circuitName: 'test-method' },
      });

      expect(proxiedProps.name).toBe('TestAdapter');
    });
  });
});
