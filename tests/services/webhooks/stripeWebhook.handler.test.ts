import { makeStripeWebhookHandler } from '@/src/services/webhooks/stripeWebhook.handler';
import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');

const testSubscription = {
  id: 'sub_test_123',
  customer: 'cus_test_456',
  status: 'active' as const,
  current_period_end: 1740000000,
  cancel_at_period_end: false,
  items: {
    data: [{ quantity: 5 }],
  },
};

const testBillingCustomer = {
  userId: 'user-123',
  stripeCustomerId: 'cus_test_456',
};

const testBillingSubscription = {
  id: 'user-123',
  stripeSubscriptionId: 'sub_test_123',
};

function buildStripeEvent(type: string, object: unknown = testSubscription) {
  return {
    id: `evt_test_${type}`,
    type,
    data: { object },
  };
}

function makeRequest(body: string, signature = 'valid-signature') {
  return new Request('http://test/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });
}

function makeHandler({
  constructedEvent = buildStripeEvent('customer.subscription.created'),
  constructEventShouldThrow = false,
  existingStripeEvent = null,
  billingCustomer = testBillingCustomer,
  billingSubscription = testBillingSubscription,
}: {
  constructedEvent?: ReturnType<typeof buildStripeEvent>;
  constructEventShouldThrow?: boolean;
  existingStripeEvent?: {
    stripeEventId: string;
    processingStatus: 'received' | 'processed' | 'ignored' | 'failed';
  } | null;
  billingCustomer?: typeof testBillingCustomer | null;
  billingSubscription?: typeof testBillingSubscription | null;
} = {}) {
  return makeStripeWebhookHandler({
    stripe: {
      webhooks: {
        constructEvent: () => {
          if (constructEventShouldThrow) throw new Error('Invalid signature');
          return constructedEvent;
        },
      },
    },
    stripeEventsRepo: {
      getById: async () => existingStripeEvent,
      create: async () => ({
        stripeEventId: constructedEvent.id,
        processingStatus: 'received' as const,
      }),
      updateById: async (_id, patch) => ({
        stripeEventId: constructedEvent.id,
        processingStatus: patch.processingStatus ?? 'received',
      }),
    },
    billingCustomersRepo: {
      getByStripeCustomerId: async () => billingCustomer,
    },
    billingSubscriptionsRepo: {
      create: async () => testBillingSubscription,
      getByStripeSubscriptionId: async () => billingSubscription,
      updateById: async () => testBillingSubscription,
    },
  });
}

describe('POST /api/webhooks/stripe', () => {
  describe('signature verification', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const handler = makeHandler();
      const req = new Request('http://test/api/webhooks/stripe', {
        method: 'POST',
        body: '{}',
      });
      const response = await handler(req);
      expect(response.status).toBe(400);
    });

    it('returns 400 when stripe signature is invalid', async () => {
      const handler = makeHandler({ constructEventShouldThrow: true });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(400);
    });
  });

  describe('idempotency', () => {
    it('returns 200 immediately when event has already been processed', async () => {
      const handler = makeHandler({
        existingStripeEvent: {
          stripeEventId: 'evt_test_customer.subscription.created',
          processingStatus: 'processed',
        },
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
    });

    it('returns 200 immediately when event has already been ignored', async () => {
      const handler = makeHandler({
        existingStripeEvent: {
          stripeEventId: 'evt_test_customer.subscription.created',
          processingStatus: 'ignored',
        },
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });
  });

  describe('customer.subscription.created', () => {
    it('returns 200 when subscription is created successfully', async () => {
      const handler = makeHandler();
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
    });

    it('returns 200 with no action when billing customer mapping is not found', async () => {
      const handler = makeHandler({ billingCustomer: null });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });

    it('uses subscription quantity as monthlyAmount', async () => {
      let capturedCreateInput: unknown = null;
      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('customer.subscription.created', {
                ...testSubscription,
                items: { data: [{ quantity: 7 }] },
              }),
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'processed' as const,
          }),
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async (input) => {
            capturedCreateInput = input;
            return testBillingSubscription;
          },
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
      });

      await handler(makeRequest('{}'));
      expect(
        (capturedCreateInput as { monthlyAmount: number }).monthlyAmount
      ).toBe(7);
    });

    it('defaults monthlyAmount to 1 when items.data is empty', async () => {
      let capturedCreateInput: unknown = null;
      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('customer.subscription.created', {
                ...testSubscription,
                items: { data: [] },
              }),
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'processed' as const,
          }),
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async (input) => {
            capturedCreateInput = input;
            return testBillingSubscription;
          },
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
      });

      await handler(makeRequest('{}'));
      expect(
        (capturedCreateInput as { monthlyAmount: number }).monthlyAmount
      ).toBe(1);
    });
  });

  describe('customer.subscription.updated', () => {
    it('returns 200 when subscription is updated successfully', async () => {
      const handler = makeHandler({
        constructedEvent: buildStripeEvent('customer.subscription.updated'),
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });

    it('returns 200 with no action when local subscription record is not found', async () => {
      const handler = makeHandler({
        constructedEvent: buildStripeEvent('customer.subscription.updated'),
        billingSubscription: null,
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });
  });

  describe('customer.subscription.deleted', () => {
    it('returns 200 when subscription is deleted successfully', async () => {
      const handler = makeHandler({
        constructedEvent: buildStripeEvent('customer.subscription.deleted', {
          ...testSubscription,
          status: 'canceled',
        }),
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });

    it('returns 200 with no action when local subscription record is not found', async () => {
      const handler = makeHandler({
        constructedEvent: buildStripeEvent('customer.subscription.deleted'),
        billingSubscription: null,
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });
  });

  describe('unhandled event types', () => {
    it('marks event as ignored and returns 200', async () => {
      const handler = makeHandler({
        constructedEvent: buildStripeEvent('payment_intent.created', {}),
      });
      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ received: true });
    });
  });

  describe('error handling', () => {
    it('returns 200 even when subscription create throws', async () => {
      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('customer.subscription.created'),
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'failed' as const,
          }),
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async () => {
            throw new Error('DB connection failed');
          },
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });
  });
});
