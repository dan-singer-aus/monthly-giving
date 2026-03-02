import { type Auth, requireUser } from '@/src/lib/auth';

type Subscription = {
  stripeSubscriptionId: string;
  status: string;
  monthlyAmount: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

type BillingSubscriptionsRepo = {
  getById: (id: string) => Promise<Subscription | null>;
};

export function makeSubscriptionHandler(props: {
  auth: Auth;
  billingSubscriptionsRepo: BillingSubscriptionsRepo;
}) {
  return async function GET(req: Request): Promise<Response> {
    const authResult = await requireUser(req, props.auth);
    if (!authResult.success) return authResult.response;
    const { userId } = authResult;

    const subscription = await props.billingSubscriptionsRepo.getById(userId);
    if (!subscription) {
      return Response.json({ subscribed: false }, { status: 200 });
    }

    return Response.json(
      {
        subscribed: true,
        subscription: {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
          monthlyAmount: subscription.monthlyAmount,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      },
      { status: 200 }
    );
  };
}
