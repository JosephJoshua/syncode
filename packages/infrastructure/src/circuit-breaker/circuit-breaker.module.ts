import { Module } from '@nestjs/common';
import { CircuitBreakerAdapter } from './circuit-breaker.adapter';

/**
 * Provides circuit breaker functionality for infrastructure adapters.
 *
 * Simply provides CircuitBreakerAdapter as a singleton service.
 * Use factory functions to wrap adapters with circuit breaker protection.
 */
@Module({
  providers: [CircuitBreakerAdapter],
  exports: [CircuitBreakerAdapter],
})
export class CircuitBreakerModule {}
