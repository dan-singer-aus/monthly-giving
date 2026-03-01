import { stripe } from '@/src/lib/stripe';
import { stripeEventsRepo } from '@/src/repos/stripeEvents.repo';
import { billingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { billingCustomersRepo } from '@/src/repos/billingCustomers.repo';
import { makeStripeWebhookHandler } from './stripeWebhook.handler';
import { usersRepo } from '@/src/repos/users.repo';
import { billingSyncLogRepo } from '@/src/repos/billingSyncLog.repo';

export const stripeWebhookHandler = makeStripeWebhookHandler({
  stripe,
  stripeEventsRepo,
  billingSubscriptionsRepo,
  billingCustomersRepo,
  usersRepo,
  billingSyncLogRepo,
});
