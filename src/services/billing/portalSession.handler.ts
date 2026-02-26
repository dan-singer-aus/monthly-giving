import { portalSessionSchema } from '@/src/validators/billing';
import { type Auth, requireUser } from '@/src/lib/auth';
import { validateBody } from '@/src/lib/validation';

type BillingCustomer = {
  userId: string;
  stripeCustomerId: string;
};

type BillingCustomersRepo = {
  getByUserId: (userId: string) => Promise<BillingCustomer | null>;
};

type StripeClient = {
  billingPortal: {
    sessions: {
      create: (params: {
        customer: string;
        return_url: string;
      }) => Promise<{ url: string }>;
    };
  };
};

export function makePortalSessionHandler(props: {
  auth: Auth;
  billingCustomersRepo: BillingCustomersRepo;
  stripe: StripeClient;
}) {
  return async function POST(req: Request): Promise<Response> {
    const authResult = await requireUser(req, props.auth);
    if (!authResult.success) return authResult.response;
    const { userId } = authResult;

    const validationResult = await validateBody(req, portalSessionSchema);
    if (!validationResult.success) return validationResult.response;
    const { returnUrl } = validationResult.data;

    const billingCustomer =
      await props.billingCustomersRepo.getByUserId(userId);
    if (!billingCustomer) {
      return Response.json(
        { error: 'No billing customer found. Please subscribe first.' },
        { status: 404 }
      );
    }

    const session = await props.stripe.billingPortal.sessions.create({
      customer: billingCustomer.stripeCustomerId,
      return_url: returnUrl,
    });

    return Response.json({ url: session.url }, { status: 200 });
  };
}
