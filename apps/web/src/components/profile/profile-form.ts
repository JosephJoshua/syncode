import { updateUserSchema } from '@syncode/contracts';
import { z } from 'zod';

// Extends the contract schema with client-friendly validation messages.
export const profileFormSchema = updateUserSchema.extend({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be 30 characters or fewer.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.')
    .optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
