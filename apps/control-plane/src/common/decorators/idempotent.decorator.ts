import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Marks an endpoint as idempotent.
 *
 * When applied, the {@link IdempotencyInterceptor} will check for an
 * `Idempotency-Key` header and deduplicate requests using the
 * `idempotency_keys` database table.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
