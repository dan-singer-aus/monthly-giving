import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { stripeEvents, users } from '@/src/db/schema';
import { UsersRepo } from '@/src/repos/users.repo';
import { BillingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { StripeEventsRepo } from '@/src/repos/stripeEvents.repo';
import { makeAdminMetricsHandler } from '@/src/services/metrics/adminMetrics.handler';
import type { Auth } from '@/src/lib/auth';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const usersRepo = new UsersRepo(db);
const billingSubscriptionsRepo = new BillingSubscriptionsRepo(db);
const stripeEventsRepo = new StripeEventsRepo(db);

const ADMIN_USER_ID = crypto.randomUUID();
const REGULAR_USER_ID = crypto.randomUUID();

const adminAuth: Auth = { getSessionUserId: async () => ADMIN_USER_ID };
const regularAuth: Auth = { getSessionUserId: async () => REGULAR_USER_ID };
const noAuth: Auth = { getSessionUserId: async () => null };

const makeRequest = () => new Request('http://test/api/admin/metrics');

function makeHandler() {
  return makeAdminMetricsHandler({
    auth: adminAuth,
    usersRepo,
    billingSubscriptionsRepo,
    stripeEventsRepo,
  });
}

beforeEach(async () => {
  await db.delete(stripeEvents);
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/admin/metrics (integration)', () => {
  it('returns 401 when unauthenticated', async () => {
    const handler = makeAdminMetricsHandler({
      auth: noAuth,
      usersRepo,
      billingSubscriptionsRepo,
      stripeEventsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(401);
  });

  it('returns 403 when user is not an admin', async () => {
    await usersRepo.create({
      id: REGULAR_USER_ID,
      email: 'regular@example.com',
      firstName: 'Regular',
      lastName: 'User',
      graduationYear: 2010,
      role: 'user',
    });

    const handler = makeAdminMetricsHandler({
      auth: regularAuth,
      usersRepo,
      billingSubscriptionsRepo,
      stripeEventsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(403);
  });

  it('returns correct metrics with the right shape when called by an admin', async () => {
    await usersRepo.create({
      id: ADMIN_USER_ID,
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      graduationYear: 2005,
      role: 'admin',
    });

    const subscriber = await usersRepo.create({
      id: crypto.randomUUID(),
      email: 'subscriber@example.com',
      firstName: 'Sub',
      lastName: 'Scriber',
      graduationYear: 2010,
    });

    await billingSubscriptionsRepo.create({
      id: subscriber!.id,
      stripeSubscriptionId: 'sub_test456',
      status: 'active',
      monthlyAmount: 16,
    });

    const response = await makeHandler()(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.totalUsers).toBe(2);
    expect(body.subscriptions.active).toBe(1);
    expect(body.subscriptions.totalMonthlyRevenue).toBe(16);
    expect(Array.isArray(body.subscriptions.byStatus)).toBe(true);
    expect(Array.isArray(body.stripeEvents.byProcessingStatus)).toBe(true);
  });
});
