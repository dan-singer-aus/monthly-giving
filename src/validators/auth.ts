import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  graduationYear: z.number().int().min(1900).max(2100),
});

export type RegisterInput = z.infer<typeof registerSchema>;
