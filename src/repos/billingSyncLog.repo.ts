import { desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { billingSyncLog, syncActionEnum } from '@/src/db/schema';

export type DbClient = PostgresJsDatabase<Record<string, never>>;

export type CreateBillingSyncLogInput = {
  userId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeEventId?: string | null;
  computedYearsOut: number;
  expectedQuantity: number;
  previousQuantity?: number | null;
  actionTaken: (typeof syncActionEnum.enumValues)[number];
};

export class BillingSyncLogRepo {
  constructor(private db: DbClient) {}

  async create(input: CreateBillingSyncLogInput) {
    const [row] = await this.db
      .insert(billingSyncLog)
      .values({
        userId: input.userId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        stripeEventId: input.stripeEventId ?? null,
        computedYearsOut: input.computedYearsOut,
        expectedQuantity: input.expectedQuantity,
        previousQuantity: input.previousQuantity ?? null,
        actionTaken: input.actionTaken,
      })
      .returning();

    return row ?? null;
  }

  async listByUserId(userId: string) {
    return this.db
      .select()
      .from(billingSyncLog)
      .where(eq(billingSyncLog.userId, userId))
      .orderBy(desc(billingSyncLog.createdAt));
  }

  async listByStripeSubscriptionId(stripeSubscriptionId: string) {
    return this.db
      .select()
      .from(billingSyncLog)
      .where(eq(billingSyncLog.stripeSubscriptionId, stripeSubscriptionId))
      .orderBy(desc(billingSyncLog.createdAt));
  }
}
