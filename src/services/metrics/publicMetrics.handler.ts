type UsersRepo = {
  countAll: () => Promise<number>;
};

type BillingSubscriptionsRepo = {
  getActiveMetrics: () => Promise<{
    activeCount: number;
    totalMonthlyRevenue: number;
  }>;
};

export function makePublicMetricsHandler(props: {
  usersRepo: UsersRepo;
  billingSubscriptionsRepo: BillingSubscriptionsRepo;
}) {
  return async function GET(_req: Request): Promise<Response> {
    const [totalUsers, activeMetrics] = await Promise.all([
      props.usersRepo.countAll(),
      props.billingSubscriptionsRepo.getActiveMetrics(),
    ]);

    return Response.json(
      {
        totalUsers,
        activeSubscribers: activeMetrics.activeCount,
        totalMonthlyRevenue: activeMetrics.totalMonthlyRevenue,
      },
      { status: 200 }
    );
  };
}
