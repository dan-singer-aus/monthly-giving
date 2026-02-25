// src/services/health/health.handler.ts
type DbPing = { ping: () => Promise<void> };

export function makeHealthHandler(deps: { db: DbPing }) {
  return async function GET(): Promise<Response> {
    try {
      await deps.db.ping();
      return Response.json({ ok: true }, { status: 200 });
    } catch (error) {
      console.error('Health check failed:', error);
      return Response.json({ ok: false }, { status: 503 });
    }
  };
}
