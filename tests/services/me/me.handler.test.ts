// src/services/me/me.handler.test.ts
import { describe, it, expect } from 'vitest';
import { makeMeHandler } from '@/src/services/me/me.handler';

describe('GET /api/me', () => {
  it('returns authenticated:false when there is no session', async () => {
    const handler = makeMeHandler({
      auth: { getSessionUserId: async () => null },
      usersRepo: { getById: async () => null },
    });

    const res = await handler(new Request('http://test/api/me'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('returns authenticated:false when session user is not found in DB', async () => {
    const handler = makeMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: { getById: async () => null },
    });

    const res = await handler(new Request('http://test/api/me'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false });
  });

  it('returns authenticated:true with user when session exists', async () => {
    const handler = makeMeHandler({
      auth: { getSessionUserId: async () => 'user-123' },
      usersRepo: {
        getById: async (id: string) =>
          id === 'user-123'
            ? {
                id: 'user-123',
                email: 'dan@example.com',
                firstName: 'Dan',
                lastName: 'Singer',
                graduationYear: 2010,
                role: 'user',
              }
            : null,
      },
    });

    const res = await handler(new Request('http://test/api/me'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      user: {
        id: 'user-123',
        email: 'dan@example.com',
        firstName: 'Dan',
        lastName: 'Singer',
        graduationYear: 2010,
        role: 'user',
      },
    });
  });
});
