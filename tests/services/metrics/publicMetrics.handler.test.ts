import { describe, it, expect } from 'vitest';
import { makePublicMetricsHandler } from '@/src/services/metrics/publicMetrics.handler';

function makeRequest() {
  return new Request('http://test/api/public/metrics');
}

describe('GET /api/public/metrics', () => {
  it('returns combined metrics from users and subscriptions repos', async () => {
    const handler = makePublicMetricsHandler({
      usersRepo: { countAll: async () => 42 },
      billingSubscriptionsRepo: {
        getActiveMetrics: async () => ({
          activeCount: 30,
          totalMonthlyRevenue: 480,
        }),
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalUsers: 42,
      activeSubscribers: 30,
      totalMonthlyRevenue: 480,
    });
  });

  it('returns zeros when no users or subscriptions exist', async () => {
    const handler = makePublicMetricsHandler({
      usersRepo: { countAll: async () => 0 },
      billingSubscriptionsRepo: {
        getActiveMetrics: async () => ({
          activeCount: 0,
          totalMonthlyRevenue: 0,
        }),
      },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalUsers: 0,
      activeSubscribers: 0,
      totalMonthlyRevenue: 0,
    });
  });
});
