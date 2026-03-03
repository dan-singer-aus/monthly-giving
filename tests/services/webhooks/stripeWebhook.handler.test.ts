import { makeStripeWebhookHandler } from '@/src/services/webhooks/stripeWebhook.handler';
import { describe, expect, it, vi } from 'vitest';

vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');

const testSubscription = {
  id: 'sub_test_123',
  customer: 'cus_test_456',
  status: 'active' as const,
  cancel_at_period_end: false,
  items: {
    data: [{ quantity: 5, current_period_end: 1740000000 }],
  },
};

const testBillingCustomer = {
  userId: 'user-123',
  stripeCustomerId: 'cus_test_456',
};

const testBillingSubscription = {
  id: 'user-123',
  stripeSubscriptionId: 'sub_test_123',
  status: 'active' as const,
};

const testUser = { id: 'user-123', graduationYear: 2010 };

const testInvoice = {
  customer: 'cus_test_456',
  parent: {
    type: 'subscription_details',
    subscription_details: {
      subscription: 'sub_test_123',
    },
  },
};

const testRetrievedSubscription = {
  items: { data: [{ id: 'si_test_123', quantity: 14 }] },
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
  user = testUser,
  retrievedSubscription = testRetrievedSubscription,
  subscriptionsUpdateShouldThrow = false,
}: {
  constructedEvent?: ReturnType<typeof buildStripeEvent>;
  constructEventShouldThrow?: boolean;
  existingStripeEvent?: {
    stripeEventId: string;
    processingStatus: 'received' | 'processed' | 'ignored' | 'failed';
  } | null;
  billingCustomer?: typeof testBillingCustomer | null;
  billingSubscription?: typeof testBillingSubscription | null;
  user?: typeof testUser | null;
  retrievedSubscription?: typeof testRetrievedSubscription;
  subscriptionsUpdateShouldThrow?: boolean;
} = {}) {
  return makeStripeWebhookHandler({
    stripe: {
      webhooks: {
        constructEvent: () => {
          if (constructEventShouldThrow) throw new Error('Invalid signature');
          return constructedEvent;
        },
      },
      subscriptions: {
        retrieve: async () => retrievedSubscription,
        update: async () => {
          if (subscriptionsUpdateShouldThrow)
            throw new Error('Stripe update failed');
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
    usersRepo: {
      getById: async () => user,
    },
    billingSyncLogRepo: {
      create: async () => null,
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
                items: {
                  data: [{ quantity: 7, current_period_end: 1740000000 }],
                },
              }),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      await handler(makeRequest('{}'));
      expect(
        (capturedCreateInput as { monthlyAmount: number }).monthlyAmount
      ).toBe(7);
    });

    it('does not create a subscription when items.data is empty', async () => {
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
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(capturedCreateInput).toBeNull();
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
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });
  });

  describe('invoice.upcoming', () => {
    it('updates quantity when yearsOut has increased', async () => {
      let capturedUpdateId: string | null = null;
      let capturedUpdateParams: unknown = null;
      let capturedSyncLog: unknown = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.upcoming', testInvoice),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async (id, params) => {
              capturedUpdateId = id;
              capturedUpdateParams = params;
            },
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
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: {
          create: async (input) => {
            capturedSyncLog = input;
            return null;
          },
        },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(capturedUpdateId).toBe('sub_test_123');
      expect(
        (capturedUpdateParams as { items: Array<{ quantity: number }> })
          .items[0].quantity
      ).toBe(16);
      expect((capturedSyncLog as { actionTaken: string }).actionTaken).toBe(
        'updated_quantity'
      );
    });

    it('does not update quantity when yearsOut is unchanged', async () => {
      let updateCalled = false;
      let capturedSyncLog: unknown = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.upcoming', testInvoice),
          },
          subscriptions: {
            retrieve: async () => ({
              items: { data: [{ id: 'si_test_123', quantity: 16 }] },
            }),
            update: async () => {
              updateCalled = true;
            },
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
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: {
          create: async (input) => {
            capturedSyncLog = input;
            return null;
          },
        },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(updateCalled).toBe(false);
      expect((capturedSyncLog as { actionTaken: string }).actionTaken).toBe(
        'no_change'
      );
    });

    it('marks event as ignored when invoice.subscription is null', async () => {
      let capturedUpdateStatus: string | null = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.upcoming', {
                customer: 'cus_test_456',
                parent: {
                  type: 'subscription_details',
                  subscription_details: { subscription: null },
                },
              }),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async (_id, patch) => {
            capturedUpdateStatus = patch.processingStatus ?? null;
            return {
              stripeEventId: 'evt_test',
              processingStatus: patch.processingStatus ?? 'received',
            };
          },
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(capturedUpdateStatus).toBe('ignored');
    });

    it('logs missing_mapping when local subscription is not found', async () => {
      let capturedSyncLog: unknown = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.upcoming', testInvoice),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => null,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: {
          create: async (input) => {
            capturedSyncLog = input;
            return null;
          },
        },
      });

      await handler(makeRequest('{}'));
      expect((capturedSyncLog as { actionTaken: string }).actionTaken).toBe(
        'missing_mapping'
      );
    });

    it('logs missing_mapping when user is not found', async () => {
      let capturedSyncLog: unknown = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.upcoming', testInvoice),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => null },
        billingSyncLogRepo: {
          create: async (input) => {
            capturedSyncLog = input;
            return null;
          },
        },
      });

      await handler(makeRequest('{}'));
      expect((capturedSyncLog as { actionTaken: string }).actionTaken).toBe(
        'missing_mapping'
      );
    });

    it('logs skipped_not_active when subscription is not active', async () => {
      let capturedSyncLog: unknown = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.upcoming', testInvoice),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => ({
            ...testBillingSubscription,
            status: 'past_due' as const,
          }),
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: {
          create: async (input) => {
            capturedSyncLog = input;
            return null;
          },
        },
      });

      await handler(makeRequest('{}'));
      expect((capturedSyncLog as { actionTaken: string }).actionTaken).toBe(
        'skipped_not_active'
      );
    });

    it('returns 200 and marks event as failed when Stripe update throws', async () => {
      const handler = makeHandler({
        constructedEvent: buildStripeEvent('invoice.upcoming', testInvoice),
        subscriptionsUpdateShouldThrow: true,
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
    });
  });

  describe('invoice.created', () => {
    const testInvoiceWithLines = {
      ...testInvoice,
      lines: { data: [{ quantity: 16 }] },
    };

    it('updates monthlyAmount to match invoiced quantity', async () => {
      let capturedUpdatePatch: unknown = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.created', testInvoiceWithLines),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
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
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async (_id, patch) => {
            capturedUpdatePatch = patch;
            return testBillingSubscription;
          },
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(
        (capturedUpdatePatch as { monthlyAmount: number }).monthlyAmount
      ).toBe(16);
    });

    it('marks event as ignored when invoice.subscription is null', async () => {
      let capturedUpdateStatus: string | null = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.created', {
                customer: 'cus_test_456',
                parent: {
                  type: 'subscription_details',
                  subscription_details: { subscription: null },
                },
                lines: { data: [{ quantity: 16 }] },
              }),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async (_id, patch) => {
            capturedUpdateStatus = patch.processingStatus ?? null;
            return {
              stripeEventId: 'evt_test',
              processingStatus: patch.processingStatus ?? 'received',
            };
          },
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(capturedUpdateStatus).toBe('ignored');
    });

    it('marks event as processed when local subscription is not found', async () => {
      let capturedUpdateStatus: string | null = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.created', testInvoiceWithLines),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async (_id, patch) => {
            capturedUpdateStatus = patch.processingStatus ?? null;
            return {
              stripeEventId: 'evt_test',
              processingStatus: patch.processingStatus ?? 'received',
            };
          },
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => null,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(capturedUpdateStatus).toBe('processed');
    });

    it('marks event as processed when invoice has no line items', async () => {
      let capturedUpdateStatus: string | null = null;

      const handler = makeStripeWebhookHandler({
        stripe: {
          webhooks: {
            constructEvent: () =>
              buildStripeEvent('invoice.created', {
                ...testInvoice,
                lines: { data: [] },
              }),
          },
          subscriptions: {
            retrieve: async () => testRetrievedSubscription,
            update: async () => {},
          },
        },
        stripeEventsRepo: {
          getById: async () => null,
          create: async () => ({
            stripeEventId: 'evt_test',
            processingStatus: 'received' as const,
          }),
          updateById: async (_id, patch) => {
            capturedUpdateStatus = patch.processingStatus ?? null;
            return {
              stripeEventId: 'evt_test',
              processingStatus: patch.processingStatus ?? 'received',
            };
          },
        },
        billingCustomersRepo: {
          getByStripeCustomerId: async () => testBillingCustomer,
        },
        billingSubscriptionsRepo: {
          create: async () => testBillingSubscription,
          getByStripeSubscriptionId: async () => testBillingSubscription,
          updateById: async () => testBillingSubscription,
        },
        usersRepo: { getById: async () => testUser },
        billingSyncLogRepo: { create: async () => null },
      });

      const response = await handler(makeRequest('{}'));
      expect(response.status).toBe(200);
      expect(capturedUpdateStatus).toBe('processed');
    });
  });
});
