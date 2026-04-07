import { updateUserSchema } from '@syncode/contracts';
import { z } from 'zod';
import i18n from '@/lib/i18n.js';

// Extends the contract schema with client-friendly validation messages.
export const profileFormSchema = updateUserSchema.extend({
  username: z
    .string()
    .min(3, i18n.t('profile:validation.usernameMinLength'))
    .max(30, i18n.t('profile:validation.usernameMaxLength'))
    .regex(/^[a-zA-Z0-9_]+$/, i18n.t('profile:validation.usernamePattern'))
    .optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
