import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { stripeEvents, processingStatusEnum } from '@/src/db/schema';

export type DbClient = typeof db;

export type CreateStripeEventInput = {
  stripeEventId: string;
  eventType: string;
  processingStatus?: (typeof processingStatusEnum.enumValues)[number];
  relatedCustomerId?: string | null;
  relatedSubscriptionId?: string | null;
  payload?: unknown;
};

export type UpdateStripeEventInput = Partial<{
  processingStatus: (typeof processingStatusEnum.enumValues)[number];
  processedAt: Date | null;
  errorMessage: string | null;
}>;

export class StripeEventsRepo {
  constructor(private db: DbClient) {}

  /**
   * Insert a new Stripe event on webhook receipt.
   * NOTE: This will throw on a duplicate stripeEventId (PK).
   * Always call getById first to enforce idempotency.
   */
  async create(input: CreateStripeEventInput) {
    const [row] = await this.db
      .insert(stripeEvents)
      .values({
        stripeEventId: input.stripeEventId,
        eventType: input.eventType,
        ...(input.processingStatus !== undefined && {
          processingStatus: input.processingStatus,
        }),
        relatedCustomerId: input.relatedCustomerId ?? null,
        relatedSubscriptionId: input.relatedSubscriptionId ?? null,
        payload: input.payload ?? null,
      })
      .returning();

    return row ?? null;
  }

  /**
   * Look up a Stripe event by its ID.
   * Used by the webhook handler for idempotency checks.
   */
  async getById(stripeEventId: string) {
    const [row] = await this.db
      .select()
      .from(stripeEvents)
      .where(eq(stripeEvents.stripeEventId, stripeEventId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Update the processing status, processedAt timestamp, or error message
   * after the event has been handled.
   */
  async updateById(stripeEventId: string, patch: UpdateStripeEventInput) {
    if (Object.keys(patch).length === 0) return this.getById(stripeEventId);

    const [row] = await this.db
      .update(stripeEvents)
      .set(patch)
      .where(eq(stripeEvents.stripeEventId, stripeEventId))
      .returning();

    return row ?? null;
  }
}
export const stripeEventsRepo = new StripeEventsRepo(db);
