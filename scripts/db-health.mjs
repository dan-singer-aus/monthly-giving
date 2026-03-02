#!/usr/bin/env node
// scripts/db-health.mjs
// Checks connectivity for both the dev and test databases.
// Uses the `pg` package already installed in the project.
// Exits 0 if all DBs are reachable, 1 if any fail.

import { Client } from 'pg';

const targets = [
  { label: 'dev ', url: process.env.DATABASE_URL },
  { label: 'test', url: process.env.DATABASE_URL_TEST },
];

let allOk = true;

for (const { label, url } of targets) {
  if (!url) {
    console.error(`  [${label}] SKIP — env var not set`);
    allOk = false;
    continue;
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    console.log(`  [${label}] OK — ${url}`);
  } catch (err) {
    console.error(`  [${label}] FAIL — ${err.message}`);
    allOk = false;
    try {
      await client.end();
    } catch {}
  }
}

process.exit(allOk ? 0 : 1);
