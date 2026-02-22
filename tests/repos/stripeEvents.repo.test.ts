import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { billingSyncLog, stripeEvents } from '@/src/db/schema';
import { StripeEventsRepo } from '@/src/repos/stripeEvents.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new StripeEventsRepo(db);

function buildStripeEventId() {
  return `evt_${crypto.randomUUID()}`;
}

beforeEach(async () => {
  // Delete billingSyncLog first — it has a FK to stripeEvents (SET NULL, but rows must
  // be cleared so stripeEvents can be deleted cleanly in tests).
  await db.delete(billingSyncLog);
  await db.delete(stripeEvents);
});

afterAll(async () => {
  await pool.end();
});

describe('StripeEventsRepo', () => {
  describe('create', () => {
    it('inserts with required fields and returns the row', async () => {
      const stripeEventId = buildStripeEventId();

      const result = await repo.create({
        stripeEventId,
        eventType: 'invoice.upcoming',
      });

      expect(result).not.toBeNull();
      expect(result!.stripeEventId).toBe(stripeEventId);
      expect(result!.eventType).toBe('invoice.upcoming');
      expect(result!.processingStatus).toBe('received');
      expect(result!.processedAt).toBeNull();
      expect(result!.errorMessage).toBeNull();
      expect(result!.relatedCustomerId).toBeNull();
      expect(result!.relatedSubscriptionId).toBeNull();
      expect(result!.payload).toBeNull();
    });

    it('inserts with all optional fields set', async () => {
      const stripeEventId = buildStripeEventId();
      const payload = { id: stripeEventId, type: 'invoice.upcoming' };

      const result = await repo.create({
        stripeEventId,
        eventType: 'invoice.upcoming',
        processingStatus: 'processed',
        relatedCustomerId: 'cus_123',
        relatedSubscriptionId: 'sub_456',
        payload,
      });

      expect(result).not.toBeNull();
      expect(result!.processingStatus).toBe('processed');
      expect(result!.relatedCustomerId).toBe('cus_123');
      expect(result!.relatedSubscriptionId).toBe('sub_456');
      expect(result!.payload).toEqual(payload);
    });
  });

  describe('getById', () => {
    it('returns the event when found', async () => {
      const stripeEventId = buildStripeEventId();
      await repo.create({ stripeEventId, eventType: 'invoice.created' });

      const result = await repo.getById(stripeEventId);

      expect(result).not.toBeNull();
      expect(result!.stripeEventId).toBe(stripeEventId);
      expect(result!.eventType).toBe('invoice.created');
    });

    it('returns null when the event does not exist', async () => {
      const result = await repo.getById('evt_unknown');
      expect(result).toBeNull();
    });
  });

  describe('updateById', () => {
    it('updates processing status and processedAt', async () => {
      const stripeEventId = buildStripeEventId();
      await repo.create({ stripeEventId, eventType: 'invoice.upcoming' });

      const processedAt = new Date();
      const result = await repo.updateById(stripeEventId, {
        processingStatus: 'processed',
        processedAt,
      });

      expect(result).not.toBeNull();
      expect(result!.processingStatus).toBe('processed');
      expect(result!.processedAt).toEqual(processedAt);
    });

    it('updates with error details when processing fails', async () => {
      const stripeEventId = buildStripeEventId();
      await repo.create({ stripeEventId, eventType: 'invoice.upcoming' });

      const result = await repo.updateById(stripeEventId, {
        processingStatus: 'failed',
        errorMessage: 'Subscription not found',
      });

      expect(result).not.toBeNull();
      expect(result!.processingStatus).toBe('failed');
      expect(result!.errorMessage).toBe('Subscription not found');
    });

    it('returns the existing row unchanged when patch is empty', async () => {
      const stripeEventId = buildStripeEventId();
      await repo.create({ stripeEventId, eventType: 'invoice.upcoming' });

      const result = await repo.updateById(stripeEventId, {});

      expect(result).not.toBeNull();
      expect(result!.processingStatus).toBe('received');
    });

    it('returns null when the event does not exist', async () => {
      const result = await repo.updateById('evt_unknown', {
        processingStatus: 'processed',
      });
      expect(result).toBeNull();
    });
  });
});
