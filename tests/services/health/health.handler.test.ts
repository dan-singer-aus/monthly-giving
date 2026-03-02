import { describe, expect, it } from 'vitest';
import { makeHealthHandler } from '@/src/services/health/health.handler';

describe('GET /api/health', () => {
  it('returns ok:true when DB is reachable', async () => {
    const handler = makeHealthHandler({
      db: { ping: async () => void 0 },
    });

    const response = await handler();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it('returns ok:false when DB is unreachable', async () => {
    const handler = makeHealthHandler({
      db: {
        ping: async () => {
          throw new Error('DB unreachable');
        },
      },
    });

    const response = await handler();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body).toEqual({ ok: false });
  });
});
