// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",

  // Drizzle Kit uses this to run migrations / introspect.
  // Keep it separate from runtime envs if you want, but this is fine.
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  // Optional:
  strict: true,
  verbose: true,
});
