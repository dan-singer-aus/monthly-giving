import { type Auth, requireUser } from '@/src/lib/auth';

const INVOICE_LIST_LIMIT = 100;

type BillingCustomer = {
  userId: string;
  stripeCustomerId: string;
};

type BillingCustomersRepo = {
  getByUserId: (userId: string) => Promise<BillingCustomer | null>;
};

type StripeInvoice = {
  id: string;
  amount_paid: number;
  created: number;
  hosted_invoice_url: string | null;
  period_start: number;
  period_end: number;
};

type StripeClient = {
  invoices: {
    list: (params: {
      customer: string;
      status: 'paid';
      limit: number;
    }) => Promise<{ data: StripeInvoice[] }>;
  };
};

export function makeReceiptsHandler(props: {
  auth: Auth;
  billingCustomersRepo: BillingCustomersRepo;
  stripe: StripeClient;
}) {
  return async function GET(req: Request): Promise<Response> {
    const authResult = await requireUser(req, props.auth);
    if (!authResult.success) return authResult.response;
    const { userId } = authResult;

    const billingCustomer =
      await props.billingCustomersRepo.getByUserId(userId);
    if (!billingCustomer) {
      return Response.json({ receipts: [] }, { status: 200 });
    }

    const invoiceList = await props.stripe.invoices.list({
      customer: billingCustomer.stripeCustomerId,
      status: 'paid',
      limit: INVOICE_LIST_LIMIT,
    });

    const receipts = invoiceList.data.map((invoice) => ({
      id: invoice.id,
      amountPaid: invoice.amount_paid,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      invoiceUrl: invoice.hosted_invoice_url,
      periodStart: new Date(invoice.period_start * 1000).toISOString(),
      periodEnd: new Date(invoice.period_end * 1000).toISOString(),
    }));

    return Response.json({ receipts }, { status: 200 });
  };
}
