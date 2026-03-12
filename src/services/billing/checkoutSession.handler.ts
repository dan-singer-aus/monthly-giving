import { checkoutSessionSchema } from '@/src/validators/billing';
import { computeYearsOut } from '@/src/domain/billing';
import { type Auth, requireUser } from '@/src/lib/auth';
import { validateBody } from '@/src/lib/validation';

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  graduationYear: number;
};

type UsersRepo = {
  getById: (id: string) => Promise<User | null>;
};

type BillingCustomer = {
  userId: string;
  stripeCustomerId: string;
};

type BillingCustomersRepo = {
  getByUserId: (userId: string) => Promise<BillingCustomer | null>;
  create: (input: {
    userId: string;
    stripeCustomerId: string;
  }) => Promise<BillingCustomer | null>;
};

type StripeClient = {
  customers: {
    create: (params: {
      email: string;
      name: string;
    }) => Promise<{ id: string }>;
  };
  checkout: {
    sessions: {
      create: (params: {
        customer: string;
        mode: 'subscription';
        line_items: Array<{ price: string; quantity: number }>;
        subscription_data: { proration_behavior: 'none' };
        success_url: string;
        cancel_url: string;
      }) => Promise<{ url: string | null }>;
    };
  };
};

export function makeCheckoutSessionHandler(props: {
  auth: Auth;
  usersRepo: UsersRepo;
  billingCustomersRepo: BillingCustomersRepo;
  stripe: StripeClient;
}) {
  async function getOrCreateBillingCustomer(
    user: User
  ): Promise<BillingCustomer | null> {
    const existing = await props.billingCustomersRepo.getByUserId(user.id);
    if (existing) return existing;

    const stripeCustomer = await props.stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
    });

    return props.billingCustomersRepo.create({
      userId: user.id,
      stripeCustomerId: stripeCustomer.id,
    });
  }

  return async function POST(req: Request) {
    const authResult = await requireUser(req, props.auth);
    if (!authResult.success) return authResult.response;
    const { userId } = authResult;

    const validationResult = await validateBody(req, checkoutSessionSchema);
    if (!validationResult.success) return validationResult.response;
    const { successUrl, cancelUrl } = validationResult.data;

    const user = await props.usersRepo.getById(userId);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const billingCustomer = await getOrCreateBillingCustomer(user);
    if (!billingCustomer) {
      console.error('Failed to persist billing customer for userId:', userId);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!STRIPE_PRICE_ID) {
      console.error('STRIPE_PRICE_ID is not configured');
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    const quantity = computeYearsOut(
      user.graduationYear,
      new Date().getFullYear()
    );

    const session = await props.stripe.checkout.sessions.create({
      customer: billingCustomer.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity }],
      subscription_data: { proration_behavior: 'none' },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      console.error(
        'Stripe returned a session without a URL for userId:',
        userId
      );
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    return Response.json({ url: session.url }, { status: 200 });
  };
}
