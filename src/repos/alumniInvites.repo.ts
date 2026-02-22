import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { alumniInvites } from '@/src/db/schema';

export type DbClient = PostgresJsDatabase<Record<string, never>>;

export type CreateAlumniInviteInput = {
  email: string;
  graduationYear: number;
  inviteCode: string;
  expiresAt?: Date | null;
};

export class AlumniInvitesRepo {
  constructor(private db: DbClient) {}

  /**
   * Create a new alumni invite.
   * NOTE: This will throw if:
   * - email already has an invite (unique constraint)
   * - inviteCode is already in use (unique constraint)
   */
  async create(input: CreateAlumniInviteInput) {
    const [row] = await this.db
      .insert(alumniInvites)
      .values({
        email: input.email,
        graduationYear: input.graduationYear,
        inviteCode: input.inviteCode,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();

    return row ?? null;
  }

  async getByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(alumniInvites)
      .where(eq(alumniInvites.email, email))
      .limit(1);

    return row ?? null;
  }

  /**
   * Look up an invite by its code.
   * Used during alumni registration to validate and retrieve invite details.
   */
  async getByInviteCode(inviteCode: string) {
    const [row] = await this.db
      .select()
      .from(alumniInvites)
      .where(eq(alumniInvites.inviteCode, inviteCode))
      .limit(1);

    return row ?? null;
  }

  /**
   * Mark an invite as used by setting usedAt to the current time.
   * Called after a successful alumni registration.
   */
  async markUsed(id: string) {
    const [row] = await this.db
      .update(alumniInvites)
      .set({ usedAt: new Date() })
      .where(eq(alumniInvites.id, id))
      .returning();

    return row ?? null;
  }
}
