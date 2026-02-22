import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  test: {
    reporter: 'verbose',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Test files share a single DB — run serially to prevent beforeEach hooks
    // in one file from deleting rows that another file's tests depend on.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
