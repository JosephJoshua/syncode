import { z } from 'zod';
import i18n from '@/lib/i18n.js';

// Reviewers must consciously pick a rating: a default of 0 is invalid until
// the user selects 1-5, so isValid stays false on first render.
const ratingSchema = z
  .number()
  .int()
  .min(1, { error: () => i18n.t('feedback:form.validation.ratingRequired') })
  .max(5);

/**
 * Build the form schema lazily so that error messages reflect the language
 * active at validation time. Calling i18n.t() at module init would freeze
 * messages to whichever language was loaded first.
 */
export function createSessionFeedbackFormSchema() {
  return z.object({
    candidateId: z
      .string()
      .min(1, { error: () => i18n.t('feedback:form.validation.candidateRequired') }),
    problemSolvingRating: ratingSchema,
    communicationRating: ratingSchema,
    codeQualityRating: ratingSchema,
    debuggingRating: ratingSchema,
    overallRating: ratingSchema,
    strengths: z
      .string()
      .trim()
      .min(1, { error: () => i18n.t('feedback:form.validation.strengthsRequired') })
      .max(2000, { error: () => i18n.t('feedback:form.validation.textMaxLength') }),
    improvements: z
      .string()
      .trim()
      .min(1, { error: () => i18n.t('feedback:form.validation.improvementsRequired') })
      .max(2000, { error: () => i18n.t('feedback:form.validation.textMaxLength') }),
    wouldPairAgain: z.boolean(),
  });
}

export type SessionFeedbackFormValues = z.infer<ReturnType<typeof createSessionFeedbackFormSchema>>;

export interface SessionFeedbackCandidate {
  userId: string;
  name: string;
}
