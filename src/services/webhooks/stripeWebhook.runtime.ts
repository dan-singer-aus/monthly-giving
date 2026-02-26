import { stripe } from '@/src/lib/stripe';
import { stripeEventsRepo } from '@/src/repos/stripeEvents.repo';
import { billingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { billingCustomersRepo } from '@/src/repos/billingCustomers.repo';
import { makeStripeWebhookHandler } from './stripeWebhook.handler';

export const stripeWebhookHandler = makeStripeWebhookHandler({
  stripe,
  stripeEventsRepo,
  billingSubscriptionsRepo,
  billingCustomersRepo,
});
