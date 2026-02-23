import { db } from '@/src/db';
import { sql } from 'drizzle-orm';

export const dbPing = {
  async ping() {
    await db.execute(sql`select 1`);
  },
};
