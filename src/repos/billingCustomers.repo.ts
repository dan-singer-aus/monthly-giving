import { eq } from 'drizzle-orm';
import { billingCustomers } from '@/src/db/schema';
import { db } from '@/src/db';
export type DbClient = typeof db;

export type CreateBillingCustomerInput = {
  userId: string;
  stripeCustomerId: string;
};

export class BillingCustomersRepo {
  constructor(private db: DbClient) {}

  /**
   * Create the userId → stripeCustomerId mapping.
   * NOTE: This will throw if:
   * - userId already has a billing customer (duplicate PK)
   * - stripeCustomerId is already in use (unique constraint)
   */
  async create(input: CreateBillingCustomerInput) {
    const [row] = await this.db
      .insert(billingCustomers)
      .values({
        userId: input.userId,
        stripeCustomerId: input.stripeCustomerId,
      })
      .returning();

    return row ?? null;
  }

  async getByUserId(userId: string) {
    const [row] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Look up a billing customer by Stripe customer ID.
   * Used by the webhook handler to resolve a Stripe event → internal user.
   */
  async getByStripeCustomerId(stripeCustomerId: string) {
    const [row] = await this.db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1);

    return row ?? null;
  }
}

export const billingCustomersRepo = new BillingCustomersRepo(db);
