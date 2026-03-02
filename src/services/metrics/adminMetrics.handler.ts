import { type Auth, requireAdmin } from '@/src/lib/auth';

type UsersRepo = {
  getById: (id: string) => Promise<{ role: string } | null>;
  countAll: () => Promise<number>;
};

type BillingSubscriptionsRepo = {
  getActiveMetrics: () => Promise<{
    activeCount: number;
    totalMonthlyRevenue: number;
  }>;
  listCountsByStatus: () => Promise<Array<{ status: string; count: number }>>;
};

type StripeEventsRepo = {
  listCountsByProcessingStatus: () => Promise<
    Array<{ processingStatus: string; count: number }>
  >;
};

export function makeAdminMetricsHandler(props: {
  auth: Auth;
  usersRepo: UsersRepo;
  billingSubscriptionsRepo: BillingSubscriptionsRepo;
  stripeEventsRepo: StripeEventsRepo;
}) {
  return async function GET(req: Request): Promise<Response> {
    const authResult = await requireAdmin(req, props.auth, props.usersRepo);
    if (!authResult.success) return authResult.response;

    const [totalUsers, activeMetrics, subscriptionsByStatus, eventsByStatus] =
      await Promise.all([
        props.usersRepo.countAll(),
        props.billingSubscriptionsRepo.getActiveMetrics(),
        props.billingSubscriptionsRepo.listCountsByStatus(),
        props.stripeEventsRepo.listCountsByProcessingStatus(),
      ]);

    return Response.json(
      {
        totalUsers,
        subscriptions: {
          active: activeMetrics.activeCount,
          totalMonthlyRevenue: activeMetrics.totalMonthlyRevenue,
          byStatus: subscriptionsByStatus,
        },
        stripeEvents: {
          byProcessingStatus: eventsByStatus,
        },
      },
      { status: 200 }
    );
  };
}
