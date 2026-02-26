import { count, eq } from 'drizzle-orm';
import { users, userRoleEnum } from '@/src/db/schema';
import { db } from '@/src/db';

export type DbClient = typeof db;
export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type CreateUserInput = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  graduationYear: number;
  role?: UserRole;
};

export type UpdateUserInput = Partial<{
  email: string;
  firstName: string;
  lastName: string;
  graduationYear: number;
  role: UserRole;
}>;

export class UsersRepo {
  constructor(private db: DbClient) {}

  /**
   * Create a user row.
   * NOTE: This will throw if:
   * - email is not unique
   * - graduationYear violates check constraint
   */
  async create(input: CreateUserInput) {
    const [row] = await this.db
      .insert(users)
      .values({
        id: input.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        graduationYear: input.graduationYear,
        role: input.role ?? 'user',
      })
      .returning();

    return row ?? null;
  }

  /**
   * Atomically inserts or returns the existing user for the given email.
   * Uses ON CONFLICT DO NOTHING to avoid a race condition between the
   * existence check and the insert.
   */
  async createOrGetByEmail(input: CreateUserInput) {
    const [row] = await this.db
      .insert(users)
      .values({
        id: input.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        graduationYear: input.graduationYear,
        role: input.role ?? 'user',
      })
      .onConflictDoNothing({ target: users.email })
      .returning();

    if (row) return row;
    // Email already existed — fetch the existing row
    return this.getByEmail(input.email);
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ?? null;
  }

  async getByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return row ?? null;
  }

  async listAll() {
    return this.db.select().from(users).orderBy(users.createdAt);
  }

  async listByRole(role: UserRole) {
    return this.db
      .select()
      .from(users)
      .where(eq(users.role, role))
      .orderBy(users.createdAt);
  }

  /**
   * Partial update (patch semantics).
   * Returns updated row or null if not found.
   */
  async updateById(id: string, patch: UpdateUserInput) {
    // Guard against accidentally updating nothing (helps catch bugs)
    if (Object.keys(patch).length === 0) {
      return this.getById(id);
    }

    const [row] = await this.db
      .update(users)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return row ?? null;
  }

  async deleteById(id: string) {
    const [row] = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return row ?? null;
  }

  /**
   * Returns the total number of registered users.
   * Used for public and admin metrics.
   */
  async countAll() {
    const [row] = await this.db.select({ total: count() }).from(users);
    return row?.total ?? 0;
  }
}

export const usersRepo = new UsersRepo(db);
