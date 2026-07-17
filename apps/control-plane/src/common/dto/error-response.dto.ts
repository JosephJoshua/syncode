import { errorResponseSchema } from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}
