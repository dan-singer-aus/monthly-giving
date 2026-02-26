import { stripe } from '@/src/lib/stripe';
import { auth } from '@/src/services/auth/auth.runtime';
import { billingCustomersRepo } from '@/src/repos/billingCustomers.repo';
import { makeReceiptsHandler } from './receipts.handler';

export const receiptsHandler = makeReceiptsHandler({
  auth,
  billingCustomersRepo,
  stripe,
});
