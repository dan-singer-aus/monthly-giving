import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users } from '@/src/db/schema';
import { BillingSubscriptionsRepo } from '@/src/repos/billingSubscriptions.repo';
import { UsersRepo } from '@/src/repos/users.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new BillingSubscriptionsRepo(db);
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
  // CASCADE delete clears billingSubscriptions automatically
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('BillingSubscriptionsRepo', () => {
  describe('create', () => {
    it('inserts and returns the subscription with required fields', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;

      const result = await repo.create({
        id: user!.id,
        stripeSubscriptionId,
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user!.id);
      expect(result!.stripeSubscriptionId).toBe(stripeSubscriptionId);
      expect(result!.status).toBe('incomplete');
      expect(result!.monthlyAmount).toBe(1);
      expect(result!.cancelAtPeriodEnd).toBe(false);
    });

    it('inserts with explicit optional fields', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;
      const periodEnd = new Date('2026-03-01T00:00:00Z');

      const result = await repo.create({
        id: user!.id,
        stripeSubscriptionId,
        status: 'active',
        monthlyAmount: 5,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('active');
      expect(result!.monthlyAmount).toBe(5);
      expect(result!.currentPeriodEnd).toEqual(periodEnd);
      expect(result!.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe('getById', () => {
    it('returns the subscription when found', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;
      await repo.create({ id: user!.id, stripeSubscriptionId });

      const result = await repo.getById(user!.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user!.id);
      expect(result!.stripeSubscriptionId).toBe(stripeSubscriptionId);
    });

    it('returns null when no subscription exists for the id', async () => {
      const result = await repo.getById(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('getByStripeSubscriptionId', () => {
    it('returns the subscription when found', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;
      await repo.create({ id: user!.id, stripeSubscriptionId });

      const result = await repo.getByStripeSubscriptionId(stripeSubscriptionId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user!.id);
      expect(result!.stripeSubscriptionId).toBe(stripeSubscriptionId);
    });

    it('returns null when the Stripe subscription ID does not exist', async () => {
      const result = await repo.getByStripeSubscriptionId('sub_unknown');
      expect(result).toBeNull();
    });
  });

  describe('updateById', () => {
    it('updates specified fields and returns the updated row', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;
      await repo.create({ id: user!.id, stripeSubscriptionId });

      const periodEnd = new Date('2026-04-01T00:00:00Z');
      const result = await repo.updateById(user!.id, {
        status: 'active',
        monthlyAmount: 8,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: true,
      });

      expect(result).not.toBeNull();
      expect(result!.status).toBe('active');
      expect(result!.monthlyAmount).toBe(8);
      expect(result!.currentPeriodEnd).toEqual(periodEnd);
      expect(result!.cancelAtPeriodEnd).toBe(true);
    });

    it('returns the existing row unchanged when patch is empty', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;
      await repo.create({
        id: user!.id,
        stripeSubscriptionId,
        monthlyAmount: 3,
      });

      const result = await repo.updateById(user!.id, {});

      expect(result).not.toBeNull();
      expect(result!.monthlyAmount).toBe(3);
    });

    it('sets updatedAt to a newer timestamp after update', async () => {
      const user = await seedUser();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;
      const created = await repo.create({ id: user!.id, stripeSubscriptionId });

      // Small delay to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await repo.updateById(user!.id, { status: 'active' });

      expect(updated!.updatedAt.getTime()).toBeGreaterThan(
        created!.updatedAt.getTime()
      );
    });

    it('returns null when the id does not exist', async () => {
      const result = await repo.updateById(crypto.randomUUID(), {
        status: 'active',
      });
      expect(result).toBeNull();
    });
  });
});
