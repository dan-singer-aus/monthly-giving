import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/src/db/schema';
import { users } from '@/src/db/schema';
import { UsersRepo, type CreateUserInput } from '@/src/repos/users.repo';
import { makeMeHandler } from '@/src/services/me/me.handler';
import { makePatchMeHandler } from '@/src/services/me/patchMe.handler';
import type { Auth } from '@/src/lib/auth';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is not set — run tests with the test DB');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });
const usersRepo = new UsersRepo(db);

const TEST_USER_ID = crypto.randomUUID();
const testAuth: Auth = { getSessionUserId: async () => TEST_USER_ID };
const noAuth: Auth = { getSessionUserId: async () => null };

async function seedTestUser(overrides: Partial<CreateUserInput> = {}) {
  return usersRepo.create({
    id: TEST_USER_ID,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    graduationYear: 2010,
    ...overrides,
  });
}

beforeEach(async () => {
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/me (integration)', () => {
  const makeRequest = () => new Request('http://test/api/me');

  it('returns authenticated:false when there is no session', async () => {
    const handler = makeMeHandler({ auth: noAuth, usersRepo });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it('returns authenticated:false when session user is not in the DB', async () => {
    const handler = makeMeHandler({ auth: testAuth, usersRepo });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it('returns authenticated:true with correct user fields when user exists', async () => {
    await seedTestUser();
    const handler = makeMeHandler({ auth: testAuth, usersRepo });
    const response = await handler(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      user: {
        id: TEST_USER_ID,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        graduationYear: 2010,
        role: 'user',
      },
    });
  });
});

describe('PATCH /api/me (integration)', () => {
  function makeRequest(body: unknown) {
    return new Request('http://test/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when unauthenticated', async () => {
    const handler = makePatchMeHandler({ auth: noAuth, usersRepo });
    const response = await handler(makeRequest({ firstName: 'Updated' }));
    expect(response.status).toBe(401);
  });

  it('returns 400 when body is invalid', async () => {
    await seedTestUser();
    const handler = makePatchMeHandler({ auth: testAuth, usersRepo });
    const response = await handler(makeRequest({ unknownField: 'bad' }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when session user is not in the DB', async () => {
    const handler = makePatchMeHandler({ auth: testAuth, usersRepo });
    const response = await handler(makeRequest({ firstName: 'Updated' }));
    expect(response.status).toBe(404);
  });

  it('updates and returns the user with the patched fields', async () => {
    await seedTestUser();
    const handler = makePatchMeHandler({ auth: testAuth, usersRepo });
    const response = await handler(
      makeRequest({ firstName: 'Updated', graduationYear: 2012 })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.firstName).toBe('Updated');
    expect(body.user.graduationYear).toBe(2012);
    expect(body.user.lastName).toBe('User');
    expect(body.user.email).toBe('test@example.com');
  });
});
