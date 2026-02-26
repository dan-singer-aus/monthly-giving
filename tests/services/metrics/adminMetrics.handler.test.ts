import { describe, it, expect } from 'vitest';
import { makeAdminMetricsHandler } from '@/src/services/metrics/adminMetrics.handler';

const adminUser = { id: 'admin-1', role: 'admin' };
const regularUser = { id: 'user-1', role: 'user' };

function makeRequest() {
  return new Request('http://test/api/admin/metrics');
}

const defaultProps = {
  usersRepo: {
    getById: async (id: string) => (id === 'admin-1' ? adminUser : null),
    countAll: async () => 50,
  },
  billingSubscriptionsRepo: {
    getActiveMetrics: async () => ({
      activeCount: 35,
      totalMonthlyRevenue: 560,
    }),
    listCountsByStatus: async () => [
      { status: 'active', count: 35 },
      { status: 'canceled', count: 10 },
    ],
  },
  stripeEventsRepo: {
    listCountsByProcessingStatus: async () => [
      { processingStatus: 'processed', count: 100 },
      { processingStatus: 'failed', count: 2 },
    ],
  },
};

describe('GET /api/admin/metrics', () => {
  it('returns 401 when there is no session', async () => {
    const handler = makeAdminMetricsHandler({
      auth: { getSessionUserId: async () => null },
      ...defaultProps,
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when the user is not an admin', async () => {
    const handler = makeAdminMetricsHandler({
      auth: { getSessionUserId: async () => 'user-1' },
      usersRepo: {
        getById: async (id: string) => (id === 'user-1' ? regularUser : null),
        countAll: async () => 50,
      },
      billingSubscriptionsRepo: defaultProps.billingSubscriptionsRepo,
      stripeEventsRepo: defaultProps.stripeEventsRepo,
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns 403 when the user id is not found in the DB', async () => {
    const handler = makeAdminMetricsHandler({
      auth: { getSessionUserId: async () => 'ghost-user' },
      usersRepo: {
        getById: async () => null,
        countAll: async () => 0,
      },
      billingSubscriptionsRepo: defaultProps.billingSubscriptionsRepo,
      stripeEventsRepo: defaultProps.stripeEventsRepo,
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns full metrics for an admin user', async () => {
    const handler = makeAdminMetricsHandler({
      auth: { getSessionUserId: async () => 'admin-1' },
      ...defaultProps,
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalUsers: 50,
      subscriptions: {
        active: 35,
        totalMonthlyRevenue: 560,
        byStatus: [
          { status: 'active', count: 35 },
          { status: 'canceled', count: 10 },
        ],
      },
      stripeEvents: {
        byProcessingStatus: [
          { processingStatus: 'processed', count: 100 },
          { processingStatus: 'failed', count: 2 },
        ],
      },
    });
  });
});
