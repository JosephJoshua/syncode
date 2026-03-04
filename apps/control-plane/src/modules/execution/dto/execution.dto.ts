import { executionResultResponseSchema, jobStatusResponseSchema } from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ExecutionResultResponseDto extends createZodDto(executionResultResponseSchema) {}
export class JobStatusResponseDto extends createZodDto(jobStatusResponseSchema) {}
