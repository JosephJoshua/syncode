import {
  sessionFeedbackProgressResponseSchema,
  sessionFeedbackResponseSchema,
  skipSessionFeedbackSchema,
  submitSessionFeedbackSchema,
} from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class SubmitSessionFeedbackDto extends createZodDto(submitSessionFeedbackSchema) {}
export class SkipSessionFeedbackDto extends createZodDto(skipSessionFeedbackSchema) {}
export class SessionFeedbackResponseDto extends createZodDto(sessionFeedbackResponseSchema) {}
export class SessionFeedbackProgressResponseDto extends createZodDto(
  sessionFeedbackProgressResponseSchema,
) {}
