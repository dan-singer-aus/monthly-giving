import { makeAdminMetricsHandler } from '@/src/services/metrics/adminMetrics.handler';
import { auth } from '@/src/services/auth/auth.runtime';
import { usersRepo } from '@/src/repos/users.repo';
import { billingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { stripeEventsRepo } from '@/src/repos/stripeEvents.repo';

export const GET = makeAdminMetricsHandler({
  auth,
  usersRepo,
  billingSubscriptionsRepo,
  stripeEventsRepo,
});
