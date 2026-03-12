import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users, subscriptionPayments } from '@/src/db/schema';
import { SubscriptionPaymentsRepo } from '@/src/repos/subscriptionPayments.repo';
import { UsersRepo } from '@/src/repos/users.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new SubscriptionPaymentsRepo(db);
const usersRepo = new UsersRepo(db);

async function seedUser(graduationYear = 2010) {
  return usersRepo.create({
    id: crypto.randomUUID(),
    email: `user-${crypto.randomUUID()}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    graduationYear,
  });
}

beforeEach(async () => {
  await db.delete(subscriptionPayments);
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('SubscriptionPaymentsRepo', () => {
  describe('create', () => {
    it('inserts and returns a payment record with all required fields', async () => {
      const user = await seedUser();

      const paymentData = {
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: user.graduationYear,
        amountCents: 5000,
        userId: user.id,
        paidAt: new Date(),
      };
      const payment = await repo.create(paymentData);

      expect(payment).toMatchObject({
        id: expect.any(String),
        stripeInvoiceId: paymentData.stripeInvoiceId,
        amountCents: paymentData.amountCents,
        userId: paymentData.userId,
        paidAt: paymentData.paidAt,
        createdAt: expect.any(Date),
      });
    });

    it('inserts with userId when user exists', async () => {
      const user = await seedUser();

      const payment = await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: user.graduationYear,
        amountCents: 5000,
        userId: user.id,
        paidAt: new Date(),
      });

      expect(payment?.userId).toBe(user.id);
    });

    it('inserts with null userId when no user provided', async () => {
      const payment = await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2020,
        amountCents: 5000,
        paidAt: new Date(),
      });

      expect(payment?.userId).toBeNull();
    });

    it('rejects duplicate stripeInvoiceId', async () => {
      const invoiceId = `inv_${crypto.randomUUID()}`;

      await repo.create({
        stripeInvoiceId: invoiceId,
        graduationYear: 2020,
        amountCents: 5000,
        paidAt: new Date(),
      });

      await expect(
        repo.create({
          stripeInvoiceId: invoiceId,
          graduationYear: 2020,
          amountCents: 5000,
          paidAt: new Date(),
        })
      ).rejects.toThrow();
    });
  });

  describe('getTotalPaymentsByGraduationYear', () => {
    it('returns an empty array when no payments exist', async () => {
      const totals = await repo.getTotalPaymentsByGraduationYear();
      expect(totals).toEqual([]);
    });

    it('returns totals grouped by graduation year', async () => {
      const user2020 = await seedUser(2020);
      const user2021 = await seedUser(2021);

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2020,
        amountCents: 5000,
        userId: user2020.id,
        paidAt: new Date(),
      });

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2021,
        amountCents: 3000,
        userId: user2021.id,
        paidAt: new Date(),
      });

      const totals = await repo.getTotalPaymentsByGraduationYear();
      expect(totals).toEqual([
        {
          graduationYear: 2020,
          totalAmountCents: '5000',
          contributorCount: 1,
        },
        {
          graduationYear: 2021,
          totalAmountCents: '3000',
          contributorCount: 1,
        },
      ]);
    });

    it('aggregates multiple payments for the same graduation year', async () => {
      const user1 = await seedUser(2020);
      const user2 = await seedUser(2020);

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2020,
        amountCents: 5000,
        userId: user1.id,
        paidAt: new Date(),
      });

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2020,
        amountCents: 3000,
        userId: user2.id,
        paidAt: new Date(),
      });

      const totals = await repo.getTotalPaymentsByGraduationYear();
      expect(totals).toEqual([
        {
          graduationYear: 2020,
          totalAmountCents: '8000',
          contributorCount: 2,
        },
      ]);
    });

    it('counts distinct contributors per graduation year', async () => {
      const user1 = await seedUser(2021);

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2021,
        amountCents: 5000,
        userId: user1.id,
        paidAt: new Date(),
      });

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2021,
        amountCents: 3000,
        userId: user1.id,
        paidAt: new Date(),
      });

      const totals = await repo.getTotalPaymentsByGraduationYear();
      expect(totals).toEqual([
        {
          graduationYear: 2021,
          totalAmountCents: '8000',
          contributorCount: 1,
        },
      ]);
    });

    it('orders results by graduation year ascending', async () => {
      const user2020 = await seedUser(2020);
      const user2021 = await seedUser(2021);

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2020,
        amountCents: 5000,
        userId: user2020.id,
        paidAt: new Date(),
      });

      await repo.create({
        stripeInvoiceId: `inv_${crypto.randomUUID()}`,
        graduationYear: 2021,
        amountCents: 3000,
        userId: user2021.id,
        paidAt: new Date(),
      });
      const totals = await repo.getTotalPaymentsByGraduationYear();
      expect(totals[0].graduationYear).toBeLessThan(totals[1].graduationYear);
    });
  });
});
