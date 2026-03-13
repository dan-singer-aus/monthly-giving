import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users } from '@/src/db/schema';
import { UsersRepo } from '@/src/repos/users.repo';
import { BillingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { makeAdminExportHandler } from '@/src/services/export/adminExport.handler';
import type { Auth } from '@/src/lib/auth';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const usersRepo = new UsersRepo(db);
const billingSubscriptionsRepo = new BillingSubscriptionsRepo(db);

const ADMIN_USER_ID = crypto.randomUUID();
const REGULAR_USER_ID = crypto.randomUUID();

const adminAuth: Auth = { getSessionUserId: async () => ADMIN_USER_ID };
const regularAuth: Auth = { getSessionUserId: async () => REGULAR_USER_ID };
const noAuth: Auth = { getSessionUserId: async () => null };

const makeRequest = () => new Request('http://test/api/admin/export');

beforeEach(async () => {
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/admin/export (integration)', () => {
  it('returns 401 when unauthenticated', async () => {
    const handler = makeAdminExportHandler({
      auth: noAuth,
      usersRepo,
      billingSubscriptionsRepo,
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

    const handler = makeAdminExportHandler({
      auth: regularAuth,
      usersRepo,
      billingSubscriptionsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(403);
  });

  it('returns all users and subscriptions with correct fields', async () => {
    const adminUser = await usersRepo.create({
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
      stripeSubscriptionId: 'sub_export123',
      status: 'active',
      monthlyAmount: 16,
    });

    const handler = makeAdminExportHandler({
      auth: adminAuth,
      usersRepo,
      billingSubscriptionsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.users).toHaveLength(2);
    const exportedAdmin = body.users.find(
      (user: { id: string }) => user.id === adminUser!.id
    );
    expect(exportedAdmin).toMatchObject({
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      graduationYear: 2005,
      role: 'admin',
    });

    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]).toMatchObject({
      userId: subscriber!.id,
      stripeSubscriptionId: 'sub_export123',
      status: 'active',
      monthlyAmount: 16,
      cancelAtPeriodEnd: false,
    });
  });

  it('returns empty arrays when no data exists (admin only)', async () => {
    await usersRepo.create({
      id: ADMIN_USER_ID,
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      graduationYear: 2005,
      role: 'admin',
    });

    const handler = makeAdminExportHandler({
      auth: adminAuth,
      usersRepo,
      billingSubscriptionsRepo,
    });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.users).toHaveLength(1); // the admin themselves
    expect(body.subscriptions).toHaveLength(0);
  });
});
