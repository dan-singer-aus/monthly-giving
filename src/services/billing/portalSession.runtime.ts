import { stripe } from '@/src/lib/stripe';
import { auth } from '@/src/services/auth/auth.runtime';
import { billingCustomersRepo } from '@/src/repos/billingCustomers.repo';
import { makePortalSessionHandler } from './portalSession.handler';

export const portalSessionHandler = makePortalSessionHandler({
  auth,
  billingCustomersRepo,
  stripe,
});
