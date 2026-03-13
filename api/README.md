# SURP API

NestJS backend for SURP.

Current status: Slice 3 (tenant-scoped authentication login with JWT access token and refresh session persistence).

## Tech Stack

- Node.js 20+
- pnpm 10+
- NestJS 11
- Prisma ORM
- PostgreSQL 16
- Jest + Supertest

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer
- Docker and Docker Compose

## Environment

Copy and edit the example env file:

```bash
cp .env.example .env
```

Required variables:

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| NODE_ENV | No | development | Runtime mode |
| PORT | No | 3001 | API port |
| DATABASE_URL | Yes | postgresql://postgres:postgres@localhost:5433/airtable_demo?schema=public | PostgreSQL connection string |
| JWT_ACCESS_TOKEN_SECRET | Yes | n/a | HMAC secret used to sign access tokens |
| JWT_ACCESS_TOKEN_TTL_SECONDS | No | 900 | Access token lifetime in seconds |
| JWT_REFRESH_TOKEN_TTL_SECONDS | No | 1209600 | Refresh session lifetime in seconds |

## Quick Start (Local)

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL only:

```bash
docker compose up -d postgres
```

3. Generate Prisma client and apply migrations:

```bash
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
```

4. Start the API in watch mode:

```bash
pnpm start:dev
```

5. Verify health endpoints:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/readiness
```

## Quick Start (Docker Stack)

Run both API and Postgres:

```bash
docker compose up --build
```

The API container runs database migrations on startup.

## Available Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| build | pnpm build | Build TypeScript to dist |
| start | pnpm start | Start compiled server |
| start:dev | pnpm start:dev | Start server in watch mode |
| start:prod | pnpm start:prod | Start production server |
| lint | pnpm lint | Run ESLint on src and test files |
| test | pnpm test | Run Jest unit test suite |
| test:watch | pnpm test:watch | Run tests in watch mode |
| test:e2e | pnpm test:e2e | Run e2e test suite |
| prisma:generate | pnpm prisma:generate | Generate Prisma client |
| prisma:migrate:dev | pnpm prisma:migrate:dev | Create/apply local migration |
| prisma:migrate:deploy | pnpm prisma:migrate:deploy | Apply migrations in deployment |
| prisma:seed | pnpm prisma:seed | Seed baseline data |

## Validation Checklist (Slice 3)

Run these before merging:

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
pnpm prisma:seed
```

Manual checks:

- GET /health returns 200 when DB is reachable
- GET /health/readiness returns 503 when DB is unavailable
- POST /auth/login with `X-Tenant-Slug: demo-tenant` and seeded credentials returns access and refresh tokens
- Login with invalid password returns 401
- Login with inactive user returns 403

## API Docs and Postman

- OpenAPI UI: <http://localhost:3001/docs>
- Postman collection: postman/surp-api.postman_collection.json

## Project Layout

```text
api/
  src/
    config/
    health/
    prisma/
  prisma/
  test/
  postman/
```

## Common Issues

1. Prisma cannot connect to DB
   - Confirm Docker is running
   - Confirm postgres container is healthy
   - Confirm DATABASE_URL matches your local port and credentials

2. Migrations fail in local dev
   - Ensure database exists and is reachable
   - Re-run: pnpm prisma:generate

3. Health endpoint returns 503
   - Database is up but not reachable by current DATABASE_URL

## Contribution Notes

- Use pnpm only
- Keep migrations additive and reversible
- Add at least one failure-path test for each new endpoint
- Update OpenAPI and Postman artifacts for each slice
