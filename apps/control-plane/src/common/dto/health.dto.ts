import { healthCheckResponseSchema, serviceStatusesSchema } from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ServiceStatusesDto extends createZodDto(serviceStatusesSchema) {}
export class HealthCheckResponseDto extends createZodDto(healthCheckResponseSchema) {}
