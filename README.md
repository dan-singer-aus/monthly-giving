# Monthly Giving

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Docker](https://www.docker.com/) + Docker Compose

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
```

Edit `.env.local` and fill in any required values (see [Environment Variables](#environment-variables)).

## Database

Start PostgreSQL locally with Docker:

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Adminer** (DB UI) on [http://localhost:8080](http://localhost:8080)

Run migrations:

```bash
npx drizzle-kit migrate
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Lint code |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Prettier |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe secret key (server-side) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (client-side) |

`.env.local` is gitignored and should never be committed.
