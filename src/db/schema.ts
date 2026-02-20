import { pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  pgTable,
  integer,
  text,
  uuid,
  index,
  check,
  timestamp,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.helpers';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
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


