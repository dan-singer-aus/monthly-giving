import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users } from '@/src/db/schema';
import { UsersRepo } from '@/src/repos/users.repo';
import { BillingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { makeSubscriptionHandler } from '@/src/services/subscription/subscription.handler';
import type { Auth } from '@/src/lib/auth';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const usersRepo = new UsersRepo(db);
const billingSubscriptionsRepo = new BillingSubscriptionsRepo(db);

const TEST_USER_ID = crypto.randomUUID();
const testAuth: Auth = { getSessionUserId: async () => TEST_USER_ID };
const noAuth: Auth = { getSessionUserId: async () => null };

const makeRequest = () => new Request('http://test/api/subscription');

beforeEach(async () => {
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/subscription (integration)', () => {
  it('returns 401 when unauthenticated', async () => {
    const handler = makeSubscriptionHandler({
      auth: noAuth,
      billingSubscriptionsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns subscribed:false when no subscription exists', async () => {
    const handler = makeSubscriptionHandler({
      auth: testAuth,
      billingSubscriptionsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscribed: false });
  });

  it('returns subscribed:true with correct fields when subscription exists', async () => {
    await usersRepo.create({
      id: TEST_USER_ID,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      graduationYear: 2010,
    });

    const periodEnd = new Date('2026-04-01T00:00:00.000Z');
    await billingSubscriptionsRepo.create({
      id: TEST_USER_ID,
      stripeSubscriptionId: 'sub_test123',
      status: 'active',
      monthlyAmount: 16,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });

    const handler = makeSubscriptionHandler({
      auth: testAuth,
      billingSubscriptionsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.subscribed).toBe(true);
    expect(body.subscription.stripeSubscriptionId).toBe('sub_test123');
    expect(body.subscription.status).toBe('active');
    expect(body.subscription.monthlyAmount).toBe(16);
    expect(body.subscription.cancelAtPeriodEnd).toBe(false);
  });
});
