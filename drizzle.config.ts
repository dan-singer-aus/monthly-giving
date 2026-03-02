// drizzle.config.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit CLI doesn't auto-load .env.local the way Next.js does
try {
  for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([^#\s][^=]*)=(.+)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
} catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',

  // Drizzle Kit uses this to run migrations / introspect.
  // Keep it separate from runtime envs if you want, but this is fine.
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  // Optional:
  strict: true,
  verbose: true,
});
