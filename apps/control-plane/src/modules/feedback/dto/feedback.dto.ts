import { sessionFeedbackResponseSchema, submitSessionFeedbackSchema } from '@syncode/contracts';
import { createZodDto } from 'nestjs-zod';

export class SubmitSessionFeedbackDto extends createZodDto(submitSessionFeedbackSchema) {}
export class SessionFeedbackResponseDto extends createZodDto(sessionFeedbackResponseSchema) {}
