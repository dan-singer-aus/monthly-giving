import { describe, it, expect } from 'vitest';
import { makeCheckoutSessionHandler } from '@/src/services/billing/checkoutSession.handler';

const testUser = {
  id: 'user-123',
  email: 'dan@example.com',
  firstName: 'Dan',
  lastName: 'Singer',
  graduationYear: 2010,
};

const existingCustomer = {
  userId: 'user-123',
  stripeCustomerId: 'cus_existing',
};

const validBody = {
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
};

function makeRequest(body: unknown) {
  return new Request('http://test/api/billing/checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeHandler({
  userId = 'user-123',
  user = testUser,
  billingCustomer = existingCustomer,
  sessionUrl = 'https://checkout.stripe.com/test',
  newCustomerId = 'cus_new',
}: {
  userId?: string | null;
  user?: typeof testUser | null;
  billingCustomer?: typeof existingCustomer | null;
  sessionUrl?: string | null;
  newCustomerId?: string;
} = {}) {
  return makeCheckoutSessionHandler({
    auth: { getSessionUserId: async () => userId },
    usersRepo: { getById: async () => user },
    billingCustomersRepo: {
      getByUserId: async () => billingCustomer,
      create: async (input) => ({ ...input }),
    },
    stripe: {
      customers: {
        create: async () => ({ id: newCustomerId }),
      },
      checkout: {
        sessions: {
          create: async () => ({ url: sessionUrl }),
        },
      },
    },
  });
}

describe('POST /api/billing/checkout-session', () => {
  it('returns 401 when unauthenticated', async () => {
    const handler = makeHandler({ userId: null });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 400 when request body is invalid', async () => {
    const handler = makeHandler();
    const response = await handler(makeRequest({ successUrl: 'not-a-url' }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when user is not found', async () => {
    const handler = makeHandler({ user: null });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(404);
  });

  it('returns 200 with checkout URL when billing customer already exists', async () => {
    const handler = makeHandler({
      sessionUrl: 'https://checkout.stripe.com/existing',
    });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://checkout.stripe.com/existing',
    });
  });

  it('creates a new Stripe customer when none exists and returns checkout URL', async () => {
    const handler = makeHandler({
      billingCustomer: null,
      newCustomerId: 'cus_new',
      sessionUrl: 'https://checkout.stripe.com/new',
    });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://checkout.stripe.com/new',
    });
  });

  it('returns 500 when Stripe returns a null session URL', async () => {
    const handler = makeHandler({ sessionUrl: null });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(500);
  });
});
