import { describe, it, expect } from 'vitest';
import { makeAdminExportHandler } from '@/src/services/export/adminExport.handler';

const adminUser = { id: 'admin-1', role: 'admin' };
const regularUser = { id: 'user-1', role: 'user' };

const sampleUser = {
  id: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  graduationYear: 2010,
  role: 'user',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const sampleSubscription = {
  id: 'user-1', // same as userId
  stripeSubscriptionId: 'sub_abc',
  status: 'active',
  monthlyAmount: 16,
  currentPeriodEnd: new Date('2026-03-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
  createdAt: new Date('2025-01-15T00:00:00.000Z'),
};

function makeRequest() {
  return new Request('http://test/api/admin/export');
}

describe('GET /api/admin/export', () => {
  it('returns 401 when there is no session', async () => {
    const handler = makeAdminExportHandler({
      auth: { getSessionUserId: async () => null },
      usersRepo: { getById: async () => null, listAll: async () => [] },
      billingSubscriptionsRepo: { listAll: async () => [] },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when the user is not an admin', async () => {
    const handler = makeAdminExportHandler({
      auth: { getSessionUserId: async () => 'user-1' },
      usersRepo: {
        getById: async (id: string) => (id === 'user-1' ? regularUser : null),
        listAll: async () => [],
      },
      billingSubscriptionsRepo: { listAll: async () => [] },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });

  it('returns users and subscriptions for an admin', async () => {
    const handler = makeAdminExportHandler({
      auth: { getSessionUserId: async () => 'admin-1' },
      usersRepo: {
        getById: async (id: string) => (id === 'admin-1' ? adminUser : null),
        listAll: async () => [sampleUser],
      },
      billingSubscriptionsRepo: { listAll: async () => [sampleSubscription] },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      graduationYear: 2010,
      role: 'user',
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]).toEqual({
      userId: 'user-1',
      stripeSubscriptionId: 'sub_abc',
      status: 'active',
      monthlyAmount: 16,
      currentPeriodEnd: '2026-03-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      createdAt: '2025-01-15T00:00:00.000Z',
    });
  });

  it('returns empty arrays when no data exists', async () => {
    const handler = makeAdminExportHandler({
      auth: { getSessionUserId: async () => 'admin-1' },
      usersRepo: {
        getById: async () => adminUser,
        listAll: async () => [],
      },
      billingSubscriptionsRepo: { listAll: async () => [] },
    });

    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ users: [], subscriptions: [] });
  });
});
