import {
  createProblemSchema,
  listBookmarksQuerySchema,
  listBookmarksResponseSchema,
  problemDetailSchema,
  problemsListQuerySchema,
  problemsListResponseSchema,
  problemsTagsResponseSchema,
  publishProblemStatusSchema,
  updateProblemSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class ProblemsListQueryDto extends createZodDto(problemsListQuerySchema) {}
export class ProblemsListResponseDto extends createZodDto(problemsListResponseSchema) {}
export class ProblemDetailDto extends createZodDto(problemDetailSchema) {}
export class CreateProblemDto extends createZodDto(createProblemSchema) {}
export class UpdateProblemDto extends createZodDto(updateProblemSchema) {}
export class PublishProblemStatusDto extends createZodDto(publishProblemStatusSchema) {}
export class ProblemsTagsResponseDto extends createZodDto(problemsTagsResponseSchema) {}

export class ListBookmarksQueryDto extends createZodDto(listBookmarksQuerySchema) {}
export class ListBookmarksResponseDto extends createZodDto(listBookmarksResponseSchema) {}
