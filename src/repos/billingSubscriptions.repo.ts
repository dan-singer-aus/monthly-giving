import { count, eq, sum } from 'drizzle-orm';
import { billingSubscriptions, subscriptionStatusEnum } from '@/src/db/schema';
import { db } from '@/src/db';

export type DbClient = typeof db;

export type CreateBillingSubscriptionInput = {
  id: string; // userId — PK and FK to users.id
  stripeSubscriptionId: string;
  status?: (typeof subscriptionStatusEnum.enumValues)[number];
  monthlyAmount?: number;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

export type UpdateBillingSubscriptionInput = Partial<{
  status: (typeof subscriptionStatusEnum.enumValues)[number];
  monthlyAmount: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}>;

export class BillingSubscriptionsRepo {
  constructor(private db: DbClient) {}

  /**
   * Create the userId → stripeSubscriptionId mapping.
   * NOTE: This will throw if:
   * - userId already has a subscription (duplicate PK)
   * - stripeSubscriptionId is already in use (unique constraint)
   */
  async create(input: CreateBillingSubscriptionInput) {
    const [row] = await this.db
      .insert(billingSubscriptions)
      .values({
        id: input.id,
        stripeSubscriptionId: input.stripeSubscriptionId,
        ...(input.status !== undefined && { status: input.status }),
        ...(input.monthlyAmount !== undefined && {
          monthlyAmount: input.monthlyAmount,
        }),
        ...(input.currentPeriodEnd !== undefined && {
          currentPeriodEnd: input.currentPeriodEnd,
        }),
        ...(input.cancelAtPeriodEnd !== undefined && {
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        }),
      })
      .returning();

    return row ?? null;
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.id, id))
      .limit(1);

    return row ?? null;
  }

  /**
   * Look up a subscription by Stripe subscription ID.
   * Used by the webhook handler to resolve a Stripe event → internal user.
   */
  async getByStripeSubscriptionId(stripeSubscriptionId: string) {
    const [row] = await this.db
      .select()
      .from(billingSubscriptions)
      .where(
        eq(billingSubscriptions.stripeSubscriptionId, stripeSubscriptionId)
      )
      .limit(1);

    return row ?? null;
  }

  async updateById(id: string, patch: UpdateBillingSubscriptionInput) {
    if (Object.keys(patch).length === 0) return this.getById(id);

    const [row] = await this.db
      .update(billingSubscriptions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(billingSubscriptions.id, id))
      .returning();

    return row ?? null;
  }

  /**
   * Returns the count of active subscriptions and their total monthly revenue
   * in a single query. Used for public and admin metrics.
   */
  async getActiveMetrics() {
    const [row] = await this.db
      .select({
        activeCount: count(),
        totalMonthlyRevenue: sum(billingSubscriptions.monthlyAmount),
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.status, 'active'));

    return {
      activeCount: row?.activeCount ?? 0,
      totalMonthlyRevenue: Number(row?.totalMonthlyRevenue ?? 0),
    };
  }

  /**
   * Returns subscription counts grouped by status.
   * Used for the admin metrics breakdown.
   */
  async listCountsByStatus() {
    return this.db
      .select({
        status: billingSubscriptions.status,
        count: count(),
      })
      .from(billingSubscriptions)
      .groupBy(billingSubscriptions.status);
  }

  /**
   * Returns all subscription rows. Used for the admin data export.
   */
  async listAll() {
    return this.db
      .select()
      .from(billingSubscriptions)
      .orderBy(billingSubscriptions.createdAt);
  }
}

export const billingSubscriptionsRepo = new BillingSubscriptionsRepo(db);
