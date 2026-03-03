import { z } from 'zod';

const SERVICE_STATUSES = ['ok', 'fail'] as const;
const HEALTH_STATUSES = ['ok', 'degraded'] as const;

export const serviceStatusesSchema = z
  .object({
    queue: z
      .enum(SERVICE_STATUSES)
      .describe('Job queue service connectivity')
      .meta({ examples: ['ok'] }),
    cache: z
      .enum(SERVICE_STATUSES)
      .describe('Cache service connectivity')
      .meta({ examples: ['ok'] }),
    storage: z
      .enum(SERVICE_STATUSES)
      .describe('Object storage service connectivity')
      .meta({ examples: ['ok'] }),
    execution: z
      .enum(SERVICE_STATUSES)
      .describe('Execution plane connectivity')
      .meta({ examples: ['ok'] }),
    ai: z
      .enum(SERVICE_STATUSES)
      .describe('AI plane connectivity')
      .meta({ examples: ['ok'] }),
    collab: z
      .enum(SERVICE_STATUSES)
      .describe('Collab plane connectivity')
      .meta({ examples: ['ok'] }),
  })
  .meta({ id: 'ServiceStatusesDto' });

export type ServiceStatuses = z.infer<typeof serviceStatusesSchema>;

export const healthCheckResponseSchema = z.object({
  status: z
    .enum(HEALTH_STATUSES)
    .describe(
      '"ok" when all services are healthy, "degraded" when one or more services are unreachable.',
    )
    .meta({ examples: ['ok'] }),
  services: serviceStatusesSchema.describe('Individual service connectivity results'),
  timestamp: z
    .string()
    .datetime()
    .describe('ISO 8601 timestamp of when the check was performed')
    .meta({ examples: ['2026-03-03T12:00:00.000Z'] }),
});

export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
