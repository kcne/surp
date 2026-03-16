# SURP API

NestJS backend for SURP.

Current status: Slice 19 (OpenAPI contract freeze and Postman scenario runner standardized).

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

1. Start PostgreSQL only:

```bash
docker compose up -d postgres
```

1. Generate Prisma client and apply migrations:

```bash
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
```

1. Start the API in watch mode:

```bash
pnpm start:dev
```

1. Verify health endpoints:

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

## Deploy on Railway (API)

Service root directory: `api`

Build command:

```bash
pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build
```

Start command:

```bash
pnpm prisma:migrate:deploy && pnpm start:prod
```

Environment checklist:

1. `NODE_ENV=production`
2. `PORT` (Railway provides this automatically)
3. `DATABASE_URL` (Railway PostgreSQL connection string)
4. `JWT_ACCESS_TOKEN_SECRET`
5. `JWT_ACCESS_TOKEN_TTL_SECONDS`
6. `JWT_REFRESH_TOKEN_TTL_SECONDS`
7. `CORS_ALLOWED_ORIGINS` including the deployed UI domain

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
| test:contract | pnpm test:contract | Run OpenAPI contract tests for critical endpoints |
| openapi:generate | pnpm openapi:generate | Generate frozen OpenAPI artifact at docs/openapi.json |
| openapi:lint | pnpm openapi:lint | Generate and lint OpenAPI schema |
| quality:gates | pnpm quality:gates | Run lint + contract test + OpenAPI lint |
| postman:run | pnpm postman:run | Run full Postman collection with local environment |
| postman:run:negative | pnpm postman:run:negative | Run only negative Postman scenarios |
| prisma:generate | pnpm prisma:generate | Generate Prisma client |
| prisma:migrate:dev | pnpm prisma:migrate:dev | Create/apply local migration |
| prisma:migrate:deploy | pnpm prisma:migrate:deploy | Apply migrations in deployment |
| prisma:seed | pnpm prisma:seed | Seed baseline data |

## Validation Checklist (Slice 18 and Slice 19)

Run these before merging:

```bash
pnpm lint
pnpm test:contract
pnpm openapi:lint
pnpm postman:run
pnpm prisma:seed
```

Manual checks:

- Frontend can consume `docs/openapi.json` without schema ambiguity.
- `Negative Scenarios` folder in Postman validates expected 4xx responses.
- `pnpm postman:run` passes on clean seeded database.

## API Docs and Postman

- OpenAPI UI: <http://localhost:3001/docs>
- OpenAPI artifact: docs/openapi.json
- Postman collection: postman/surp-api.postman_collection.json
- Postman local environment: postman/surp-api.local.postman_environment.json
- Postman staging environment: postman/surp-api.staging.postman_environment.json

## Versioning and Breaking Changes

- API contract version is defined in `src/config/swagger.config.ts` as `OPENAPI_VERSION`.
- Any breaking API change requires a version bump and release note entry.
- See `docs/quality-gates.md` for detailed gate and policy rules.

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
