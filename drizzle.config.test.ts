// drizzle.config.test.ts — points drizzle-kit at the test database
import { readFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "drizzle-kit";

// drizzle-kit CLI doesn't auto-load .env.local the way Next.js does
try {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([^#\s][^=]*)=(.+)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
  }
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_TEST!,
  },
  strict: true,
  verbose: true,
});
