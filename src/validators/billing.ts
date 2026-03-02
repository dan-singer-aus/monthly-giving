import { z } from 'zod';

export const checkoutSessionSchema = z.object({
  successUrl: z.url(),
  cancelUrl: z.url(),
});

export const portalSessionSchema = z.object({
  returnUrl: z.url(),
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
export type PortalSessionInput = z.infer<typeof portalSessionSchema>;
