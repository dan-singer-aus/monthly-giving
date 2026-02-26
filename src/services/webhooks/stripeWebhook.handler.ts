const SUBSCRIPTION_CREATED_EVENT = 'customer.subscription.created';
const SUBSCRIPTION_UPDATED_EVENT = 'customer.subscription.updated';
const SUBSCRIPTION_DELETED_EVENT = 'customer.subscription.deleted';

type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

type StripeSubscription = {
  id: string;
  customer: string;
  status: SubscriptionStatus;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{ quantity?: number }>;
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

type BillingSubscriptionsRepo = {
  create: (input: {
    id: string;
    stripeSubscriptionId: string;
    status?: SubscriptionStatus;
    monthlyAmount?: number;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }) => Promise<{ id: string; stripeSubscriptionId: string } | null>;
  getByStripeSubscriptionId: (
    stripeSubscriptionId: string
  ) => Promise<{ id: string; stripeSubscriptionId: string } | null>;
  updateById: (
    id: string,
    patch: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean;
    }
  ) => Promise<{ id: string; stripeSubscriptionId: string } | null>;
};

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
    typeof record.current_period_end !== 'number' ||
    typeof record.cancel_at_period_end !== 'boolean'
  ) {
    return null;
  }

  const items = record.items as { data?: unknown } | undefined;
  if (!Array.isArray(items?.data)) {
    return null;
  }

  return record as unknown as StripeSubscription;
}

export function makeStripeWebhookHandler(props: {
  stripe: StripeClient;
  stripeEventsRepo: StripeEventsRepo;
  billingSubscriptionsRepo: BillingSubscriptionsRepo;
  billingCustomersRepo: BillingCustomersRepo;
}) {
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

    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
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

    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await props.billingSubscriptionsRepo.updateById(existingSubscription.id, {
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  return async function POST(req: Request): Promise<Response> {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return Response.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }

    let event: StripeEvent;
    try {
      event = props.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        stripeWebhookSecret
      );
    } catch (error) {
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

      await props.stripeEventsRepo.create({
        stripeEventId: event.id,
        eventType: event.type,
        processingStatus: 'received',
        relatedCustomerId: subscription?.customer ?? null,
        relatedSubscriptionId: subscription?.id ?? null,
        payload: event,
      });

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
      } else {
        await props.stripeEventsRepo.updateById(event.id, {
          processingStatus: 'ignored',
          processedAt: new Date(),
        });
        return Response.json({ received: true }, { status: 200 });
      }

      await props.stripeEventsRepo.updateById(event.id, {
        processingStatus: 'processed',
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
