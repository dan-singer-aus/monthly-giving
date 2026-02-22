# Monthly Giving

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development](#development)
- [Before running tests](#before-running-tests)
- [Scripts](#scripts)
  - [App](#app)
  - [Code quality](#code-quality)
  - [Database — Docker](#database--docker)
  - [Database — Drizzle](#database--drizzle)
  - [Database — Resets](#database--resets)
- [Environment Variables](#environment-variables)
- [Schema & Migrations](#schema--migrations)

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) + Docker Compose

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (defaults match Docker Compose — no edits needed to run locally)
cp .env.example .env.local

# 3. Start both Postgres containers (dev on :5432, test on :5433) + Adminer UI on :8080
npm run db:up

# 4. Confirm both databases are reachable
npm run db:health

# 5. Apply migrations
npm run drizzle:migrate         # dev DB
npm run drizzle:migrate:test    # test DB

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Adminer (DB browser) is at [http://localhost:8080](http://localhost:8080).

Edit `.env.local` if you need to point at an external database or add API keys (see [Environment Variables](#environment-variables)).

## Development

```bash
npm run dev
```

On subsequent days, if the containers aren't running, start them first:

```bash
npm run db:up && npm run dev
```

## Before running tests

Reset the test database to a guaranteed clean state before each test suite:

```bash
npm run db:reset:test
```

This destroys and recreates the test container and re-applies all migrations. The dev database is completely unaffected.

## Scripts

### App

| Command         | Description                      |
| --------------- | -------------------------------- |
| `npm run dev`   | Start dev server with hot reload |
| `npm run build` | Build for production             |
| `npm run start` | Start production server          |

### Code quality

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `npm run lint`     | Lint code with ESLint          |
| `npm run lint:fix` | Lint and auto-fix violations   |
| `npm run format`   | Format all files with Prettier |

### Database — Docker

| Command             | Description                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `npm run db:up`     | Start both Postgres containers (dev + test) in the background                              |
| `npm run db:down`   | Stop and remove all containers                                                             |
| `npm run db:health` | Check live connectivity to both dev and test DBs — exits non-zero if either is unreachable |

### Database — Drizzle

| Command                        | Description                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `npm run drizzle:generate`     | Generate a new migration file from schema changes                                         |
| `npm run drizzle:migrate`      | Apply pending migrations to the **dev** DB                                                |
| `npm run drizzle:migrate:test` | Apply pending migrations to the **test** DB                                               |
| `npm run drizzle:push`         | Push schema directly to dev DB without a migration file (useful during early development) |
| `npm run drizzle:studio`       | Open Drizzle Studio — a browser UI for browsing the dev DB                                |

### Database — Resets

| Command                 | Description                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:reset`      | Full reset of the **dev** DB: stops containers, restarts, waits, then re-applies all migrations                                                                         |
| `npm run db:reset:test` | Full reset of the **test** DB only: removes and recreates the test container, then re-applies all migrations. Run this before a test suite for a guaranteed clean slate |

## Environment Variables

| Variable                             | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `DATABASE_URL`                       | PostgreSQL connection string for the dev database  |
| `DATABASE_URL_TEST`                  | PostgreSQL connection string for the test database |
| `STRIPE_SECRET_KEY`                  | Stripe secret key (server-side only)               |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (exposed to the browser)    |

`.env.local` is gitignored and should never be committed.

## Schema & Migrations

Schemas are defined in [src/db/schema.ts](src/db/schema.ts). Drizzle Kit generates migration files into [src/db/migrations/](src/db/migrations/).

After changing the schema:

```bash
npm run drizzle:generate        # creates the migration file
npm run drizzle:migrate         # applies it to dev
npm run drizzle:migrate:test    # applies it to test
```
