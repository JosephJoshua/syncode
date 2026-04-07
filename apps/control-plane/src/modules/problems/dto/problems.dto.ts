import {
  problemDetailSchema,
  problemsListQuerySchema,
  problemsListResponseSchema,
  problemsTagsResponseSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProblemsListQueryDto extends createZodDto(problemsListQuerySchema) {}
export class ProblemsListResponseDto extends createZodDto(problemsListResponseSchema) {}
export class ProblemDetailDto extends createZodDto(problemDetailSchema) {}
export class ProblemsTagsResponseDto extends createZodDto(problemsTagsResponseSchema) {}
