import { z } from 'zod';
import { portalSessionSchema } from '@/src/validators/billing';

type Auth = {
  getSessionUserId: (req: Request) => Promise<string | null>;
};

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
    const userId = await props.auth.getSessionUserId(req);
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parseResult = portalSessionSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json(
        {
          error: 'Invalid request body',
          details: z.flattenError(parseResult.error),
        },
        { status: 400 }
      );
    }
    const { returnUrl } = parseResult.data;

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
