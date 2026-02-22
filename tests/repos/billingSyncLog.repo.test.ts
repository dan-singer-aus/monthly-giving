import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { billingSyncLog, stripeEvents, users } from '@/src/db/schema';
import { BillingSyncLogRepo } from '@/src/repos/billingSyncLog.repo';
import { UsersRepo } from '@/src/repos/users.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new BillingSyncLogRepo(db);
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

async function seedStripeEvent() {
  const [row] = await db
    .insert(stripeEvents)
    .values({
      stripeEventId: `evt_${crypto.randomUUID()}`,
      eventType: 'invoice.upcoming',
    })
    .returning();
  return row!;
}

beforeEach(async () => {
  // billingSyncLog rows are NOT cascade-deleted when users or stripeEvents are deleted
  // (both FKs are SET NULL), so we must delete them explicitly first.
  await db.delete(billingSyncLog);
  await db.delete(users);
  await db.delete(stripeEvents);
});

afterAll(async () => {
  await pool.end();
});

describe('BillingSyncLogRepo', () => {
  describe('create', () => {
    it('inserts with required fields and returns the row', async () => {
      const result = await repo.create({
        computedYearsOut: 5,
        expectedQuantity: 5,
        actionTaken: 'updated_quantity',
      });

      expect(result).not.toBeNull();
      expect(result!.computedYearsOut).toBe(5);
      expect(result!.expectedQuantity).toBe(5);
      expect(result!.actionTaken).toBe('updated_quantity');
      expect(result!.userId).toBeNull();
      expect(result!.stripeSubscriptionId).toBeNull();
      expect(result!.stripeEventId).toBeNull();
      expect(result!.previousQuantity).toBeNull();
      expect(result!.id).toBeTruthy();
    });

    it('inserts with all optional fields set', async () => {
      const user = await seedUser();
      const stripeEvent = await seedStripeEvent();
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;

      const result = await repo.create({
        userId: user!.id,
        stripeSubscriptionId,
        stripeEventId: stripeEvent.stripeEventId,
        computedYearsOut: 10,
        expectedQuantity: 10,
        previousQuantity: 9,
        actionTaken: 'updated_quantity',
      });

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(user!.id);
      expect(result!.stripeSubscriptionId).toBe(stripeSubscriptionId);
      expect(result!.previousQuantity).toBe(9);
    });
  });

  describe('listByUserId', () => {
    it('returns entries for the user ordered newest-first', async () => {
      const user = await seedUser();

      await repo.create({
        userId: user!.id,
        computedYearsOut: 5,
        expectedQuantity: 5,
        actionTaken: 'no_change',
      });
      await repo.create({
        userId: user!.id,
        computedYearsOut: 6,
        expectedQuantity: 6,
        actionTaken: 'updated_quantity',
      });

      const results = await repo.listByUserId(user!.id);

      expect(results).toHaveLength(2);
      // Newest first — the second insert has the higher computedYearsOut
      expect(results[0]!.computedYearsOut).toBe(6);
      expect(results[1]!.computedYearsOut).toBe(5);
    });

    it('returns an empty array when no entries exist for the user', async () => {
      const results = await repo.listByUserId(crypto.randomUUID());
      expect(results).toEqual([]);
    });

    it('does not return entries belonging to other users', async () => {
      const userA = await seedUser();
      const userB = await seedUser();

      await repo.create({
        userId: userA!.id,
        computedYearsOut: 5,
        expectedQuantity: 5,
        actionTaken: 'no_change',
      });

      const results = await repo.listByUserId(userB!.id);
      expect(results).toHaveLength(0);
    });
  });

  describe('listByStripeSubscriptionId', () => {
    it('returns entries for the subscription ordered newest-first', async () => {
      const stripeSubscriptionId = `sub_${crypto.randomUUID()}`;

      await repo.create({
        stripeSubscriptionId,
        computedYearsOut: 3,
        expectedQuantity: 3,
        actionTaken: 'no_change',
      });
      await repo.create({
        stripeSubscriptionId,
        computedYearsOut: 4,
        expectedQuantity: 4,
        actionTaken: 'updated_quantity',
      });

      const results =
        await repo.listByStripeSubscriptionId(stripeSubscriptionId);

      expect(results).toHaveLength(2);
      expect(results[0]!.computedYearsOut).toBe(4);
      expect(results[1]!.computedYearsOut).toBe(3);
    });

    it('returns an empty array when no entries exist for the subscription', async () => {
      const results = await repo.listByStripeSubscriptionId('sub_unknown');
      expect(results).toEqual([]);
    });
  });
});
