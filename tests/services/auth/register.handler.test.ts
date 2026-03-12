import { describe, it, expect } from 'vitest';
import { makeRegisterHandler } from '@/src/services/auth/register.handler';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UsersRepo } from '@/src/repos/users.repo';

const validBody = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  password: 'password123',
  graduationYear: 2024,
};

type SignUpResult = {
  data: { user: { id: string } | null } | null;
  error: { status: number; message: string } | null;
};

type MakeHandlerOptions = {
  signUpResult?: SignUpResult;
  createUser?: () => Promise<void>;
};

function makeRequest(body: unknown) {
  return new Request('http://test/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeHandler(options: MakeHandlerOptions = {}) {
  const signUpResult = options.signUpResult ?? {
    data: { user: { id: 'user-123' } },
    error: null,
  };
  const createUser = options.createUser ?? (async () => {});
  return makeRegisterHandler({
    supabase: {
      auth: {
        signUp: async () => signUpResult,
      },
    } as unknown as SupabaseClient,
    usersRepo: {
      create: createUser,
    } as unknown as UsersRepo,
  });
}

describe('register handler', () => {
  it('registers a user successfully', async () => {
    const handler = makeHandler();
    const req = makeRequest(validBody);
    const res = await handler(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ message: 'User registered successfully' });
  });

  it('returns 400 for invalid input', async () => {
    const handler = makeHandler();
    const req = makeRequest({ ...validBody, email: 'invalid-email' });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('returns 409 if email is already in use', async () => {
    const handler = makeHandler({
      signUpResult: {
        data: null,
        error: { status: 422, message: 'Email already in use' },
      },
    });
    const req = makeRequest(validBody);
    const res = await handler(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toEqual({ error: 'Email already in use' });
  });

  it('returns 500 if Supabase signUp fails', async () => {
    const handler = makeHandler({
      signUpResult: {
        data: null,
        error: { status: 500, message: 'Internal Server Error' },
      },
    });
    const req = makeRequest(validBody);
    const res = await handler(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'Failed to create user' });
  });

  it('returns 500 if user creation in database fails', async () => {
    const handler = makeHandler({
      createUser: async () => {
        throw new Error('DB error');
      },
    });
    const req = makeRequest(validBody);
    const res = await handler(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'Failed to create user in database' });
  });

  it('returns 500 if user ID is not found after registration', async () => {
    const handler = makeHandler({
      signUpResult: { data: { user: null }, error: null },
    });
    const req = makeRequest(validBody);
    const res = await handler(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'User ID not found after registration' });
  });
});
