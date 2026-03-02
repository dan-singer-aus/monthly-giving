import { makeSubscriptionHandler } from '@/src/services/subscription/subscription.handler';
import { auth } from '@/src/services/auth/auth.runtime';
import { billingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';

export const GET = makeSubscriptionHandler({ auth, billingSubscriptionsRepo });
