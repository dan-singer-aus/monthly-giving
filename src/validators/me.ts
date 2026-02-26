import { z } from 'zod';

export const patchMeSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    graduationYear: z.number().int().min(1900).max(2100).optional(),
  })
  .strict();

export type PatchMeInput = z.infer<typeof patchMeSchema>;
