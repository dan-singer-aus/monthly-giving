import { makePublicMetricsHandler } from '@/src/services/metrics/publicMetrics.handler';
import { usersRepo } from '@/src/repos/users.repo';
import { billingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';

export const GET = makePublicMetricsHandler({
  usersRepo,
  billingSubscriptionsRepo,
});
