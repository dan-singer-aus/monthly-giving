import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { alumniInvites } from '@/src/db/schema';
import { AlumniInvitesRepo } from '@/src/repos/alumniInvites.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new AlumniInvitesRepo(db);

function buildInvite(
  overrides: Partial<{
    email: string;
    graduationYear: number;
    inviteCode: string;
  }> = {}
) {
  return {
    email: `invite-${crypto.randomUUID()}@test.com`,
    graduationYear: 2010,
    inviteCode: crypto.randomUUID(),
    ...overrides,
  };
}

beforeEach(async () => {
  await db.delete(alumniInvites);
});

afterAll(async () => {
  await pool.end();
});

describe('AlumniInvitesRepo', () => {
  describe('create', () => {
    it('inserts and returns the invite', async () => {
      const input = buildInvite();

      const result = await repo.create(input);

      expect(result).not.toBeNull();
      expect(result!.email).toBe(input.email);
      expect(result!.graduationYear).toBe(input.graduationYear);
      expect(result!.inviteCode).toBe(input.inviteCode);
      expect(result!.expiresAt).toBeNull();
      expect(result!.usedAt).toBeNull();
      expect(result!.id).toBeTruthy();
    });

    it('inserts with an expiration date', async () => {
      const expiresAt = new Date('2026-12-31T00:00:00Z');
      const result = await repo.create(buildInvite({ ...{ expiresAt } }));

      // Re-create with expiresAt directly
      const input = buildInvite();
      const resultWithExpiry = await repo.create({ ...input, expiresAt });

      expect(resultWithExpiry!.expiresAt).toEqual(expiresAt);
      // suppress unused warning on first result
      expect(result).not.toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('returns the invite when found', async () => {
      const input = buildInvite();
      await repo.create(input);

      const result = await repo.getByEmail(input.email);

      expect(result).not.toBeNull();
      expect(result!.email).toBe(input.email);
      expect(result!.inviteCode).toBe(input.inviteCode);
    });

    it('returns null when no invite exists for the email', async () => {
      const result = await repo.getByEmail('nobody@test.com');
      expect(result).toBeNull();
    });
  });

  describe('getByInviteCode', () => {
    it('returns the invite when found', async () => {
      const input = buildInvite();
      await repo.create(input);

      const result = await repo.getByInviteCode(input.inviteCode);

      expect(result).not.toBeNull();
      expect(result!.inviteCode).toBe(input.inviteCode);
      expect(result!.email).toBe(input.email);
    });

    it('returns null when the invite code does not exist', async () => {
      const result = await repo.getByInviteCode('nonexistent-code');
      expect(result).toBeNull();
    });
  });

  describe('markUsed', () => {
    it('sets usedAt and returns the updated invite', async () => {
      const input = buildInvite();
      const created = await repo.create(input);

      const result = await repo.markUsed(created!.id);

      expect(result).not.toBeNull();
      expect(result!.usedAt).not.toBeNull();
      expect(result!.usedAt!.getTime()).toBeGreaterThan(
        created!.createdAt.getTime() - 1
      );
    });

    it('returns null when the id does not exist', async () => {
      const result = await repo.markUsed(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });
});
