import { describe, it, expect } from 'vitest';
import { makePortalSessionHandler } from '@/src/services/billing/portalSession.handler';

const existingCustomer = {
  userId: 'user-123',
  stripeCustomerId: 'cus_test',
};

const validBody = {
  returnUrl: 'https://example.com/dashboard',
};

function makeRequest(body: unknown) {
  return new Request('http://test/api/billing/portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeHandler({
  userId = 'user-123',
  billingCustomer = existingCustomer,
  portalUrl = 'https://billing.stripe.com/session/test',
}: {
  userId?: string | null;
  billingCustomer?: typeof existingCustomer | null;
  portalUrl?: string;
} = {}) {
  return makePortalSessionHandler({
    auth: { getSessionUserId: async () => userId },
    billingCustomersRepo: { getByUserId: async () => billingCustomer },
    stripe: {
      billingPortal: {
        sessions: {
          create: async () => ({ url: portalUrl }),
        },
      },
    },
  });
}

describe('POST /api/billing/portal-session', () => {
  it('returns 401 when unauthenticated', async () => {
    const handler = makeHandler({ userId: null });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(401);
  });

  it('returns 400 when request body is invalid', async () => {
    const handler = makeHandler();
    const response = await handler(makeRequest({ returnUrl: 'not-a-url' }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when user has no billing customer', async () => {
    const handler = makeHandler({ billingCustomer: null });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(404);
  });

  it('returns 200 with portal URL when customer exists', async () => {
    const handler = makeHandler({
      portalUrl: 'https://billing.stripe.com/session/test',
    });
    const response = await handler(makeRequest(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://billing.stripe.com/session/test',
    });
  });
});
