import { type Auth, requireAdmin } from '@/src/lib/auth';

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  graduationYear: number;
  role: string;
  createdAt: Date;
};

type Subscription = {
  id: string;
  stripeSubscriptionId: string;
  status: string;
  monthlyAmount: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
};

type UsersRepo = {
  getById: (id: string) => Promise<{ role: string } | null>;
  listAll: () => Promise<User[]>;
};

type BillingSubscriptionsRepo = {
  listAll: () => Promise<Subscription[]>;
};

export function makeAdminExportHandler(props: {
  auth: Auth;
  usersRepo: UsersRepo;
  billingSubscriptionsRepo: BillingSubscriptionsRepo;
}) {
  return async function GET(req: Request): Promise<Response> {
    const authResult = await requireAdmin(req, props.auth, props.usersRepo);
    if (!authResult.success) return authResult.response;

    const [users, subscriptions] = await Promise.all([
      props.usersRepo.listAll(),
      props.billingSubscriptionsRepo.listAll(),
    ]);

    return Response.json(
      {
        users: users.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          graduationYear: user.graduationYear,
          role: user.role,
          createdAt: user.createdAt,
        })),
        // billingSubscriptions.id is the userId FK
        subscriptions: subscriptions.map((subscription) => ({
          userId: subscription.id,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
          monthlyAmount: subscription.monthlyAmount,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          createdAt: subscription.createdAt,
        })),
      },
      { status: 200 }
    );
  };
}
