import { pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  pgTable,
  integer,
  text,
  uuid,
  boolean,
  jsonb,
  index,
  check,
  timestamp,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]);
export const processingStatusEnum = pgEnum('processing_status', [
  'received',
  'processed',
  'ignored',
  'failed',
]);
export const syncActionEnum = pgEnum('sync_action', [
  'no_change',
  'updated_quantity',
  'missing_mapping',
  'skipped_not_active',
  'error',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').unique().notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    graduationYear: integer('graduation_year').notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    ...timestamps,
  },
  (table) => [
    check(
      'users_graduation_year_range',
      sql`${table.graduationYear} BETWEEN 1900 AND 2100`
    ),
    index('idx_users_graduation_year').on(table.graduationYear),
    index('idx_users_role').on(table.role),
  ]
);

export const billingCustomers = pgTable(
  'billing_customers',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),

    stripeCustomerId: text('stripe_customer_id').notNull().unique(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index('idx_billing_customers_stripe_customer_id').on(
      table.stripeCustomerId
    ),
  ]
);

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),

    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
    status: subscriptionStatusEnum('status').notNull().default('incomplete'),
    monthlyAmount: integer('monthly_amount').notNull().default(1),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index('idx_billing_subscriptions_status').on(table.status),
    index('idx_billing_subscriptions_period_end').on(table.currentPeriodEnd),
  ]
);

export const stripeEvents = pgTable(
  'stripe_events',
  {
    stripeEventId: text('stripe_event_id').primaryKey(),
    eventType: text('event_type').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingStatus: processingStatusEnum('processing_status')
      .notNull()
      .default('received'),
    errorMessage: text('error_message'),
    relatedCustomerId: text('related_customer_id'),
    relatedSubscriptionId: text('related_subscription_id'),
    payload: jsonb('payload'),
  },
  (table) => [
    index('idx_stripe_events_type_received').on(
      table.eventType,
      table.receivedAt
    ),
    index('idx_stripe_events_related_customer').on(table.relatedCustomerId),
    index('idx_stripe_events_related_subscription').on(
      table.relatedSubscriptionId
    ),
  ]
);

export const billingSyncLog = pgTable(
  'billing_sync_log',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripeEventId: text('stripe_event_id').references(
      () => stripeEvents.stripeEventId,
      { onDelete: 'set null' }
    ),
    computedYearsOut: integer('computed_years_out').notNull(),
    expectedQuantity: integer('expected_quantity').notNull(),
    previousQuantity: integer('previous_quantity'),
    actionTaken: syncActionEnum('action_taken').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      'billing_sync_log_years_out_min',
      sql`${table.computedYearsOut} >= 1`
    ),
    check(
      'billing_sync_log_expected_quantity_min',
      sql`${table.expectedQuantity} >= 1`
    ),
    index('idx_billing_sync_log_user_created').on(
      table.userId,
      table.createdAt
    ),
    index('idx_billing_sync_log_subscription_created').on(
      table.stripeSubscriptionId,
      table.createdAt
    ),
  ]
);

export const alumniInvites = pgTable(
  'alumni_invites',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text('email').notNull().unique(),
    graduationYear: integer('graduation_year').notNull(),
    inviteCode: text('invite_code').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    check(
      'alumni_invites_graduation_year_range',
      sql`${table.graduationYear} BETWEEN 1900 AND 2100`
    ),
    index('idx_alumni_invites_expires').on(table.expiresAt),
    index('idx_alumni_invites_used').on(table.usedAt),
  ]
);
