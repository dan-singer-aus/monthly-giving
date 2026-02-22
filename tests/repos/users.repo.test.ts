import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users } from '@/src/db/schema';
import { UsersRepo, type CreateUserInput } from '@/src/repos/users.repo';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const repo = new UsersRepo(db);

function buildUser(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  return {
    id: crypto.randomUUID(),
    email: `user-${crypto.randomUUID()}@test.com`,
    firstName: 'Test',
    lastName: 'User',
    graduationYear: 2010,
    ...overrides,
  };
}

beforeEach(async () => {
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('UsersRepo', () => {
  describe('create', () => {
    it('inserts and returns the new user', async () => {
      const input = buildUser();
      const result = await repo.create(input);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(input.id);
      expect(result!.email).toBe(input.email);
      expect(result!.firstName).toBe(input.firstName);
      expect(result!.lastName).toBe(input.lastName);
      expect(result!.graduationYear).toBe(input.graduationYear);
      expect(result!.role).toBe('user');
    });
  });

  describe('createOrGetByEmail', () => {
    it('inserts and returns the new user when email does not exist', async () => {
      const input = buildUser();
      const result = await repo.createOrGetByEmail(input);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(input.id);
      expect(result!.email).toBe(input.email);
    });

    it('returns the existing user when email already exists', async () => {
      const original = buildUser();
      await repo.create(original);

      const duplicate = buildUser({ email: original.email });
      const result = await repo.createOrGetByEmail(duplicate);

      expect(result).not.toBeNull();
      // Must return the original user's id, not the duplicate's
      expect(result!.id).toBe(original.id);
      expect(result!.email).toBe(original.email);
    });
  });

  describe('getById', () => {
    it('returns the user when found', async () => {
      const input = buildUser();
      await repo.create(input);

      const result = await repo.getById(input.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(input.id);
    });

    it('returns null when the user does not exist', async () => {
      const result = await repo.getById(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('returns the user when found', async () => {
      const input = buildUser();
      await repo.create(input);

      const result = await repo.getByEmail(input.email);

      expect(result).not.toBeNull();
      expect(result!.email).toBe(input.email);
    });

    it('returns null when the email does not exist', async () => {
      const result = await repo.getByEmail('nobody@test.com');
      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    it('returns an empty array when the table is empty', async () => {
      const result = await repo.listAll();
      expect(result).toEqual([]);
    });

    it('returns all users', async () => {
      await repo.create(buildUser());
      await repo.create(buildUser());

      const result = await repo.listAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('listByRole', () => {
    it('returns only users matching the given role', async () => {
      await repo.create(buildUser({ role: 'user' }));
      await repo.create(buildUser({ role: 'user' }));
      await repo.create(buildUser({ role: 'admin' }));

      const regularUsers = await repo.listByRole('user');
      const admins = await repo.listByRole('admin');

      expect(regularUsers).toHaveLength(2);
      expect(admins).toHaveLength(1);
    });

    it('returns an empty array when no users match the role', async () => {
      await repo.create(buildUser({ role: 'user' }));

      const result = await repo.listByRole('admin');

      expect(result).toEqual([]);
    });
  });

  describe('updateById', () => {
    it('updates specified fields and returns the updated row', async () => {
      const input = buildUser({ firstName: 'Before' });
      await repo.create(input);

      const result = await repo.updateById(input.id, { firstName: 'After' });

      expect(result).not.toBeNull();
      expect(result!.firstName).toBe('After');
      // Unpatched fields are preserved
      expect(result!.lastName).toBe(input.lastName);
      expect(result!.email).toBe(input.email);
    });

    it('returns the existing row unchanged when patch is empty', async () => {
      const input = buildUser();
      await repo.create(input);

      const result = await repo.updateById(input.id, {});

      expect(result).not.toBeNull();
      expect(result!.id).toBe(input.id);
      expect(result!.firstName).toBe(input.firstName);
    });

    it('returns null when the user does not exist', async () => {
      const result = await repo.updateById(crypto.randomUUID(), {
        firstName: 'Ghost',
      });
      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('deletes and returns the deleted row', async () => {
      const input = buildUser();
      await repo.create(input);

      const result = await repo.deleteById(input.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(input.id);

      const gone = await repo.getById(input.id);
      expect(gone).toBeNull();
    });

    it('returns null when the user does not exist', async () => {
      const result = await repo.deleteById(crypto.randomUUID());
      expect(result).toBeNull();
    });
  });
});
