import { subscriptionPayments } from '@/src/db/schema';
import { db } from '@/src/db';
import { countDistinct, sum } from 'drizzle-orm';
export type DbClient = typeof db;

export type PaymentInput = {
  userId?: string;
  stripeInvoiceId: string;
  amountCents: number;
  paidAt: Date;
  graduationYear: number;
};

export class SubscriptionPaymentsRepo {
  constructor(private db: DbClient) {}

  async create(input: PaymentInput) {
    const [row] = await this.db
      .insert(subscriptionPayments)
      .values({
        userId: input.userId ?? null,
        stripeInvoiceId: input.stripeInvoiceId,
        amountCents: input.amountCents,
        paidAt: input.paidAt,
        graduationYear: input.graduationYear,
      })
      .returning();

    return row ?? null;
  }

  async getTotalPaymentsByGraduationYear() {
    return this.db
      .select({
        contributorCount: countDistinct(subscriptionPayments.userId),
        graduationYear: subscriptionPayments.graduationYear,
        totalAmountCents: sum(subscriptionPayments.amountCents),
      })
      .from(subscriptionPayments)
      .groupBy(subscriptionPayments.graduationYear)
      .orderBy(subscriptionPayments.graduationYear);
  }
}

export const subscriptionPaymentsRepo = new SubscriptionPaymentsRepo(db);
