import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users } from '@/src/db/schema';
import { BillingCustomersRepo } from '@/src/repos/billingCustomers.repo';
import { UsersRepo } from '@/src/repos/users.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new BillingCustomersRepo(db);
const usersRepo = new UsersRepo(db);

async function seedUser() {
  return usersRepo.create({
    id: crypto.randomUUID(),
    email: `user-${crypto.randomUUID()}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    graduationYear: 2010,
  });
}

beforeEach(async () => {
  // CASCADE delete clears billingCustomers automatically
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('BillingCustomersRepo', () => {
  describe('create', () => {
    it('inserts and returns the billing customer', async () => {
      const user = await seedUser();
      const stripeCustomerId = `cus_${crypto.randomUUID()}`;

      const result = await repo.create({
        userId: user!.id,
        stripeCustomerId,
      });

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(user!.id);
      expect(result!.stripeCustomerId).toBe(stripeCustomerId);
    });
  });

  describe('getByUserId', () => {
    it('returns the billing customer when found', async () => {
      const user = await seedUser();
      const stripeCustomerId = `cus_${crypto.randomUUID()}`;
      await repo.create({ userId: user!.id, stripeCustomerId });

      const result = await repo.getByUserId(user!.id);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(user!.id);
      expect(result!.stripeCustomerId).toBe(stripeCustomerId);
    });

    it('returns null when the user has no billing customer', async () => {
      const result = await repo.getByUserId(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('getByStripeCustomerId', () => {
    it('returns the billing customer when found', async () => {
      const user = await seedUser();
      const stripeCustomerId = `cus_${crypto.randomUUID()}`;
      await repo.create({ userId: user!.id, stripeCustomerId });

      const result = await repo.getByStripeCustomerId(stripeCustomerId);

      expect(result).not.toBeNull();
      expect(result!.stripeCustomerId).toBe(stripeCustomerId);
      expect(result!.userId).toBe(user!.id);
    });

    it('returns null when the Stripe customer ID does not exist', async () => {
      const result = await repo.getByStripeCustomerId('cus_unknown');
      expect(result).toBeNull();
    });
  });
});
