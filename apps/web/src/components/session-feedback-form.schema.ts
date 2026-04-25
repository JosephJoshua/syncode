import { z } from 'zod';
import i18n from '@/lib/i18n.js';

const ratingSchema = z.number().int().min(1).max(5);

export const sessionFeedbackFormSchema = z.object({
  candidateId: z.string().min(1, i18n.t('feedback:form.validation.candidateRequired')),
  problemSolvingRating: ratingSchema,
  communicationRating: ratingSchema,
  codeQualityRating: ratingSchema,
  debuggingRating: ratingSchema,
  overallRating: ratingSchema,
  strengths: z
    .string()
    .trim()
    .min(1, i18n.t('feedback:form.validation.strengthsRequired'))
    .max(2000, i18n.t('feedback:form.validation.textMaxLength')),
  improvements: z
    .string()
    .trim()
    .min(1, i18n.t('feedback:form.validation.improvementsRequired'))
    .max(2000, i18n.t('feedback:form.validation.textMaxLength')),
  wouldPairAgain: z.boolean(),
});

export type SessionFeedbackFormValues = z.infer<typeof sessionFeedbackFormSchema>;

export interface SessionFeedbackCandidate {
  userId: string;
  name: string;
}
