import { describe, it, expect } from 'vitest';
import { makeSubscriptionHandler } from '@/src/services/subscription/subscription.handler';

const baseSubscription = {
  stripeSubscriptionId: 'sub_abc123',
  status: 'active',
  monthlyAmount: 16,
  currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
};

function makeRequest() {
  return new Request('http://test/api/subscription');
}

describe('GET /api/subscription', () => {
  it('returns 401 when there is no session', async () => {
    const handler = makeSubscriptionHandler({
      auth: { getSessionUserId: async () => null },
      billingSubscriptionsRepo: { getById: async () => null },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns subscribed:false when no subscription exists', async () => {
    const handler = makeSubscriptionHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingSubscriptionsRepo: { getById: async () => null },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ subscribed: false });
  });

  it('returns subscribed:true with subscription details when subscription exists', async () => {
    const handler = makeSubscriptionHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingSubscriptionsRepo: {
        getById: async (id) => (id === 'user-123' ? baseSubscription : null),
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      subscribed: true,
      subscription: {
        stripeSubscriptionId: 'sub_abc123',
        status: 'active',
        monthlyAmount: 16,
        currentPeriodEnd: '2026-03-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
      },
    });
  });

  it('reflects cancelAtPeriodEnd when set', async () => {
    const handler = makeSubscriptionHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      billingSubscriptionsRepo: {
        getById: async () => ({ ...baseSubscription, cancelAtPeriodEnd: true }),
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).subscription.cancelAtPeriodEnd).toBe(true);
  });
});
