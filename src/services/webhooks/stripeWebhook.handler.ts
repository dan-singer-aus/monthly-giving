import { computeYearsOut } from '@/src/domain/billing';

const SUBSCRIPTION_CREATED_EVENT = 'customer.subscription.created';
const SUBSCRIPTION_UPDATED_EVENT = 'customer.subscription.updated';
const SUBSCRIPTION_DELETED_EVENT = 'customer.subscription.deleted';
const INVOICE_UPCOMING_EVENT = 'invoice.upcoming';
const INVOICE_CREATED_EVENT = 'invoice.created';
const INVOICE_PAID_EVENT = 'invoice.paid';

// ============================================================
// Types
// ============================================================

type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

type StripeSubscriptionItem = {
  quantity?: number;
  current_period_end: number;
};

type StripeInvoiceLine = {
  quantity: number | null;
};

type StripeInvoice = {
  subscription: string | null;
  customer: string;
  lines: {
    data: StripeInvoiceLine[];
  };
};

type StripePaidInvoice = {
  id: string;
  customer: string;
  amount_paid: number;
  paid_at: number | null;
};

type StripeSubscription = {
  id: string;
  customer: string;
  status: SubscriptionStatus;
  cancel_at_period_end: boolean;
  items: {
    data: Array<StripeSubscriptionItem>;
  };
};

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

type StripeClient = {
  webhooks: {
    constructEvent: (
      rawBody: string,
      signature: string,
      secret: string
    ) => StripeEvent;
  };

  subscriptions: {
    retrieve: (id: string) => Promise<{
      items: { data: Array<{ id: string; quantity?: number }> };
    }>;
    update: (
      id: string,
      params: {
        items: Array<{ id: string; quantity: number }>;
        proration_behavior: 'none';
      }
    ) => Promise<unknown>;
  };
};

type StripeEventsRepo = {
  getById: (
    stripeEventId: string
  ) => Promise<{ stripeEventId: string; processingStatus: string } | null>;
  create: (input: {
    stripeEventId: string;
    eventType: string;
    processingStatus?: 'received' | 'processed' | 'ignored' | 'failed';
    relatedCustomerId?: string | null;
    relatedSubscriptionId?: string | null;
    payload?: unknown;
  }) => Promise<{ stripeEventId: string; processingStatus: string } | null>;
  updateById: (
    stripeEventId: string,
    patch: {
      processingStatus?: 'received' | 'processed' | 'ignored' | 'failed';
      processedAt?: Date | null;
      errorMessage?: string | null;
    }
  ) => Promise<{ stripeEventId: string; processingStatus: string } | null>;
};

type BillingCustomersRepo = {
  getByStripeCustomerId: (
    stripeCustomerId: string
  ) => Promise<{ userId: string; stripeCustomerId: string } | null>;
};

type UsersRepo = {
  getById: (
    id: string
  ) => Promise<{ id: string; graduationYear: number } | null>;
};

type BillingSyncLogRepo = {
  create: (input: {
    userId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeEventId?: string | null;
    computedYearsOut: number;
    expectedQuantity: number;
    previousQuantity?: number | null;
    actionTaken:
      | 'no_change'
      | 'updated_quantity'
      | 'missing_mapping'
      | 'skipped_not_active'
      | 'error';
  }) => Promise<unknown>;
};

type BillingSubscriptionsRepo = {
  create: (input: {
    id: string;
    stripeSubscriptionId: string;
    status?: SubscriptionStatus;
    monthlyAmount?: number;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }) => Promise<{ id: string; stripeSubscriptionId: string } | null>;
  getByStripeSubscriptionId: (stripeSubscriptionId: string) => Promise<{
    id: string;
    stripeSubscriptionId: string;
    status: SubscriptionStatus;
  } | null>;
  updateById: (
    id: string,
    patch: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
      monthlyAmount?: number;
    }
  ) => Promise<{ id: string; stripeSubscriptionId: string } | null>;
};

type SubscriptionPaymentsRepo = {
  create: (input: {
    userId?: string;
    stripeInvoiceId: string;
    amountCents: number;
    paidAt: Date;
    graduationYear: number;
  }) => Promise<unknown>;
};

type WebhookHandlerProps = {
  stripe: StripeClient;
  stripeEventsRepo: StripeEventsRepo;
  billingSubscriptionsRepo: BillingSubscriptionsRepo;
  billingCustomersRepo: BillingCustomersRepo;
  usersRepo: UsersRepo;
  billingSyncLogRepo: BillingSyncLogRepo;
  subscriptionPaymentsRepo: SubscriptionPaymentsRepo;
};

// ============================================================
// Errors
// ============================================================

class SignatureError extends Error {}
class ConfigurationError extends Error {}

// ============================================================
// Request parsing
// ============================================================

async function parseAndVerifyRequest(
  req: Request,
  stripe: StripeClient
): Promise<StripeEvent> {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    throw new SignatureError('Missing stripe-signature header');
  }

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeWebhookSecret) {
    throw new ConfigurationError('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    stripeWebhookSecret
  );
}

// ============================================================
// Event data extractors
// ============================================================

function extractSubscriptionData(
  event: StripeEvent
): StripeSubscription | null {
  const { object } = event.data;

  if (typeof object !== 'object' || object === null) {
    return null;
  }

  const record = object as Record<string, unknown>;

  if (
    typeof record.id !== 'string' ||
    typeof record.customer !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.cancel_at_period_end !== 'boolean'
  ) {
    return null;
  }

  const items = record.items as { data?: unknown } | undefined;
  if (!Array.isArray(items?.data) || items.data.length === 0) {
    return null;
  }

  const firstItem = items.data[0] as Record<string, unknown>;
  if (typeof firstItem.current_period_end !== 'number') {
    return null;
  }

  return record as unknown as StripeSubscription;
}

function extractInvoiceData(event: StripeEvent): StripeInvoice | null {
  const { object } = event.data;
  if (typeof object !== 'object' || object === null) return null;

  const record = object as Record<string, unknown>;

  if (typeof record.customer !== 'string') return null;

  // Stripe API 2025-09-30.clover+: subscription ID lives at
  // parent.subscription_details.subscription (not top-level)
  if (typeof record.parent !== 'object' || record.parent === null) return null;
  const parent = record.parent as Record<string, unknown>;

  if (
    parent.type !== 'subscription_details' ||
    typeof parent.subscription_details !== 'object' ||
    parent.subscription_details === null
  ) {
    return null;
  }

  const details = parent.subscription_details as Record<string, unknown>;
  const subscriptionId =
    typeof details.subscription === 'string' ? details.subscription : null;

  return {
    subscription: subscriptionId,
    customer: record.customer,
    lines: {
      data: Array.isArray(
        (record.lines as { data?: unknown } | undefined)?.data
      )
        ? (record.lines as { data: Array<StripeInvoiceLine> }).data
        : [],
    },
  };
}

function extractPaidInvoiceData(event: StripeEvent): StripePaidInvoice | null {
  const { object } = event.data;
  if (typeof object !== 'object' || object === null) return null;

  const record = object as Record<string, unknown>;

  if (
    typeof record.id !== 'string' ||
    typeof record.customer !== 'string' ||
    typeof record.amount_paid !== 'number' ||
    (record.paid_at !== null && typeof record.paid_at !== 'number')
  ) {
    return null;
  }

  return record as unknown as StripePaidInvoice;
}

// ============================================================
// Handler factory
// ============================================================

export function makeStripeWebhookHandler(props: WebhookHandlerProps) {
  async function handleSubscriptionCreated(
    event: StripeEvent,
    subscription: StripeSubscription
  ): Promise<void> {
    const billingCustomer =
      await props.billingCustomersRepo.getByStripeCustomerId(
        subscription.customer
      );

    if (!billingCustomer) {
      console.warn(
        `No billing customer mapping found for Stripe customer: ${subscription.customer}. Event ${event.id} processed with no action.`
      );
      return;
    }

    const currentPeriodEnd = new Date(
      subscription.items.data[0].current_period_end * 1000
    );
    const monthlyAmount = subscription.items.data[0]?.quantity ?? 1;

    await props.billingSubscriptionsRepo.create({
      id: billingCustomer.userId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      monthlyAmount,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  async function handleSubscriptionUpdatedOrDeleted(
    event: StripeEvent,
    subscription: StripeSubscription
  ): Promise<void> {
    const existingSubscription =
      await props.billingSubscriptionsRepo.getByStripeSubscriptionId(
        subscription.id
      );

    if (!existingSubscription) {
      console.warn(
        `No local subscription record found for Stripe subscription: ${subscription.id}. Event ${event.id} processed with no action.`
      );
      return;
    }

    const currentPeriodEnd = new Date(
      subscription.items.data[0].current_period_end * 1000
    );

    await props.billingSubscriptionsRepo.updateById(existingSubscription.id, {
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  async function handleInvoiceUpcoming(
    event: StripeEvent,
    invoice: { subscription: string; customer: string }
  ): Promise<void> {
    const localSub =
      await props.billingSubscriptionsRepo.getByStripeSubscriptionId(
        invoice.subscription
      );
    if (!localSub) {
      await props.billingSyncLogRepo.create({
        stripeSubscriptionId: invoice.subscription,
        stripeEventId: event.id,
        computedYearsOut: 1,
        expectedQuantity: 1,
        actionTaken: 'missing_mapping',
      });
      return;
    }

    const user = await props.usersRepo.getById(localSub.id);
    if (!user) {
      await props.billingSyncLogRepo.create({
        userId: localSub.id,
        stripeSubscriptionId: invoice.subscription,
        stripeEventId: event.id,
        computedYearsOut: 1,
        expectedQuantity: 1,
        actionTaken: 'missing_mapping',
      });
      return;
    }

    const yearsOut = computeYearsOut(
      user.graduationYear,
      new Date().getFullYear()
    );

    if (localSub.status !== 'active') {
      await props.billingSyncLogRepo.create({
        userId: user.id,
        stripeSubscriptionId: invoice.subscription,
        stripeEventId: event.id,
        computedYearsOut: yearsOut,
        expectedQuantity: yearsOut,
        actionTaken: 'skipped_not_active',
      });
      return;
    }
    const stripeSubscription = await props.stripe.subscriptions.retrieve(
      invoice.subscription
    );
    const previousQuantity = stripeSubscription.items.data[0]?.quantity ?? 1;

    if (previousQuantity === yearsOut) {
      await props.billingSyncLogRepo.create({
        userId: user.id,
        stripeSubscriptionId: invoice.subscription,
        stripeEventId: event.id,
        computedYearsOut: yearsOut,
        expectedQuantity: yearsOut,
        previousQuantity,
        actionTaken: 'no_change',
      });
      return;
    }

    await props.stripe.subscriptions.update(invoice.subscription, {
      items: [{ id: stripeSubscription.items.data[0].id, quantity: yearsOut }],
      proration_behavior: 'none',
    });

    await props.billingSyncLogRepo.create({
      userId: user.id,
      stripeSubscriptionId: invoice.subscription,
      stripeEventId: event.id,
      computedYearsOut: yearsOut,
      expectedQuantity: yearsOut,
      previousQuantity,
      actionTaken: 'updated_quantity',
    });
  }

  async function handleInvoiceCreated(
    event: StripeEvent,
    invoice: StripeInvoice
  ): Promise<void> {
    if (!invoice.subscription) {
      return;
    }

    const localSub =
      await props.billingSubscriptionsRepo.getByStripeSubscriptionId(
        invoice.subscription
      );

    if (!localSub) {
      return;
    }

    const firstLine = invoice.lines.data[0];
    if (!firstLine || firstLine.quantity === null) {
      return;
    }
    await props.billingSubscriptionsRepo.updateById(localSub.id, {
      monthlyAmount: firstLine.quantity,
    });
  }

  async function handleInvoicePaid(
    event: StripeEvent,
    paidInvoice: StripePaidInvoice
  ): Promise<void> {
    const billingCustomer =
      await props.billingCustomersRepo.getByStripeCustomerId(
        paidInvoice.customer
      );

    if (!billingCustomer) {
      console.warn(
        `No billing customer mapping found for Stripe customer: ${paidInvoice.customer}. Invoice paid event ${event.id} processed with no action.`
      );
      return;
    }

    const user = await props.usersRepo.getById(billingCustomer.userId);
    if (!user) {
      console.warn(
        `No user found for billing customer with user ID: ${billingCustomer.userId}. Invoice paid event ${event.id} processed with no action.`
      );
      return;
    }

    const paidAt =
      paidInvoice.paid_at !== null
        ? new Date(paidInvoice.paid_at * 1000)
        : new Date();

    await props.subscriptionPaymentsRepo.create({
      userId: billingCustomer.userId,
      stripeInvoiceId: paidInvoice.id,
      amountCents: paidInvoice.amount_paid,
      paidAt,
      graduationYear: user.graduationYear,
    });
  }

  async function dispatchEventHandler(
    event: StripeEvent,
    subscription: StripeSubscription | null,
    invoice: StripeInvoice | null,
    paidInvoice: StripePaidInvoice | null
  ): Promise<'processed' | 'ignored'> {
    if (event.type === SUBSCRIPTION_CREATED_EVENT) {
      if (subscription) {
        await handleSubscriptionCreated(event, subscription);
      } else {
        console.warn(
          `${event.type} event ${event.id} has no valid subscription object`
        );
      }
    } else if (
      event.type === SUBSCRIPTION_UPDATED_EVENT ||
      event.type === SUBSCRIPTION_DELETED_EVENT
    ) {
      if (subscription) {
        await handleSubscriptionUpdatedOrDeleted(event, subscription);
      } else {
        console.warn(
          `${event.type} event ${event.id} has no valid subscription object`
        );
      }
    } else if (event.type === INVOICE_UPCOMING_EVENT) {
      if (!invoice) {
        console.warn(
          `${event.type} event ${event.id} has no valid invoice object`
        );
      } else if (!invoice.subscription) {
        return 'ignored';
      } else {
        await handleInvoiceUpcoming(
          event,
          invoice as { subscription: string; customer: string }
        );
      }
    } else if (event.type === INVOICE_CREATED_EVENT) {
      if (!invoice) {
        console.warn(
          `${event.type} event ${event.id} has no valid invoice object`
        );
      } else if (!invoice.subscription) {
        return 'ignored';
      } else {
        await handleInvoiceCreated(event, invoice);
      }
    } else if (event.type === INVOICE_PAID_EVENT) {
      if (!paidInvoice) {
        console.warn(
          `${event.type} event ${event.id} has no valid paid invoice object`
        );
      } else {
        await handleInvoicePaid(event, paidInvoice);
      }
    } else {
      return 'ignored';
    }

    return 'processed';
  }

  return async function POST(req: Request): Promise<Response> {
    let event: StripeEvent;
    try {
      event = await parseAndVerifyRequest(req, props.stripe);
    } catch (error) {
      if (error instanceof ConfigurationError) {
        console.error((error as Error).message);
        return Response.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
      console.error('Stripe signature verification failed:', error);
      return Response.json(
        { error: 'Invalid webhook signature' },
        { status: 400 }
      );
    }

    // After this point, always return 200 to prevent Stripe from retrying
    try {
      const existingEvent = await props.stripeEventsRepo.getById(event.id);

      if (
        existingEvent?.processingStatus === 'processed' ||
        existingEvent?.processingStatus === 'ignored'
      ) {
        return Response.json({ received: true }, { status: 200 });
      }

      const subscription = extractSubscriptionData(event);
      const invoice = extractInvoiceData(event);
      const paidInvoice = extractPaidInvoiceData(event);

      await props.stripeEventsRepo.create({
        stripeEventId: event.id,
        eventType: event.type,
        processingStatus: 'received',
        relatedCustomerId:
          subscription?.customer ??
          invoice?.customer ??
          paidInvoice?.customer ??
          null,
        relatedSubscriptionId:
          subscription?.id ?? invoice?.subscription ?? null,
        payload: event,
      });

      const outcome = await dispatchEventHandler(
        event,
        subscription,
        invoice,
        paidInvoice
      );

      await props.stripeEventsRepo.updateById(event.id, {
        processingStatus: outcome,
        processedAt: new Date(),
      });

      return Response.json({ received: true }, { status: 200 });
    } catch (error) {
      console.error(`Failed to process Stripe event ${event.id}:`, error);

      try {
        await props.stripeEventsRepo.updateById(event.id, {
          processingStatus: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });
      } catch (updateError) {
        console.error(
          'Failed to update Stripe event status to failed:',
          updateError
        );
      }

      return Response.json({ received: true }, { status: 200 });
    }
  };
}
