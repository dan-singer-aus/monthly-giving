import { stripe } from '@/src/lib/stripe';
import { auth } from '@/src/services/auth/auth.runtime';
import { usersRepo } from '@/src/repos/users.repo';
import { billingCustomersRepo } from '@/src/repos/billingCustomers.repo';
import { makeCheckoutSessionHandler } from './checkoutSession.handler';

export const checkoutSessionHandler = makeCheckoutSessionHandler({
  auth,
  usersRepo,
  billingCustomersRepo,
  stripe,
});
