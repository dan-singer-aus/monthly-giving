import { describe, it, expect } from 'vitest';
import { makePatchMeHandler } from '@/src/services/me/patchMe.handler';

const baseUser = {
  id: 'user-123',
  email: 'dan@example.com',
  firstName: 'Dan',
  lastName: 'Singer',
  graduationYear: 2010,
  role: 'user' as const,
};

function makeRequest(body: unknown) {
  return new Request('http://test/api/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/me', () => {
  it('returns 401 when there is no session', async () => {
    const handler = makePatchMeHandler({
      auth: { getSessionUserId: async () => null },
      usersRepo: { updateById: async () => null },
    });

    const res = await handler(makeRequest({ firstName: 'New' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when the request body is invalid', async () => {
    const handler = makePatchMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: { updateById: async () => null },
    });

    const res = await handler(makeRequest({ firstName: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when the request body has unknown keys', async () => {
    const handler = makePatchMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: { updateById: async () => null },
    });

    const res = await handler(makeRequest({ role: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the user is not found', async () => {
    const handler = makePatchMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: { updateById: async () => null },
    });

    const res = await handler(makeRequest({ firstName: 'New' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'User not found' });
  });

  it('returns updated user on success', async () => {
    const handler = makePatchMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: {
        updateById: async (id, patch) =>
          id === 'user-123' ? { ...baseUser, ...patch } : null,
      },
    });

    const res = await handler(makeRequest({ firstName: 'Daniel' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: 'user-123',
        email: 'dan@example.com',
        firstName: 'Daniel',
        lastName: 'Singer',
        graduationYear: 2010,
        role: 'user',
      },
    });
  });

  it('allows partial updates', async () => {
    const handler = makePatchMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: {
        updateById: async (id, patch) =>
          id === 'user-123' ? { ...baseUser, ...patch } : null,
      },
    });

    const res = await handler(makeRequest({ graduationYear: 2012 }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.graduationYear).toBe(2012);
  });
});
