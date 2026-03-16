# SURP

System for Unified Ride Processing.

SURP is a full-stack ride operations platform with:

- `api/`: NestJS + Prisma backend
- `ui/`: Next.js frontend

## Features

- Tenant-scoped backend architecture
- JWT-based authentication and session handling
- Health and readiness endpoints
- Modular frontend for lines, stations, passengers, rides, and reservations

## Tech Stack

- Backend: NestJS, Prisma, PostgreSQL
- Frontend: Next.js, TypeScript, Tailwind CSS
- Tooling: pnpm, Docker, Jest

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

### 1. Install dependencies

```bash
cd api && pnpm install
cd ../ui && pnpm install
```

### 2. Start backend database

```bash
cd api
docker compose up -d postgres
```

### 3. Configure and run backend

```bash
cd api
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm start:dev
```

Backend docs: `http://localhost:3001/docs`

### 4. Run frontend

```bash
cd ui
pnpm dev
```

Frontend: `http://localhost:3000`

## Repository Structure

```text
.
├── api/    # NestJS backend
└── ui/     # Next.js frontend
```

## Deploy on Railway

Recommended setup is two Railway services plus one PostgreSQL instance:

1. `api` service (root directory: `api`)
2. `ui` service (root directory: `ui`)
3. `postgres` service (Railway PostgreSQL)

### API service settings

Build command:

```bash
pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm build
```

Start command:

```bash
pnpm prisma:migrate:deploy && pnpm start:prod
```

Required environment variables:

1. `NODE_ENV=production`
2. `PORT` (provided by Railway)
3. `DATABASE_URL` (from Railway PostgreSQL)
4. `JWT_ACCESS_TOKEN_SECRET`
5. `JWT_ACCESS_TOKEN_TTL_SECONDS=900`
6. `JWT_REFRESH_TOKEN_TTL_SECONDS=1209600`
7. `CORS_ALLOWED_ORIGINS=https://<your-ui-domain>`

### UI service settings

Build command:

```bash
pnpm install --frozen-lockfile && pnpm build
```

Start command:

```bash
pnpm start
```

Required environment variable:

1. `NEXT_PUBLIC_API_URL=https://<your-api-domain>`

### Post-deploy checks

1. API health endpoint responds: `/health`
2. API docs endpoint responds: `/docs`
3. UI can authenticate against API with tenant header flows
4. CORS allows UI domain and blocks unknown origins

## Contributing

- Keep changes focused and small.
- Add tests for new behavior and at least one failure path.
- Update API docs and Postman collection when endpoints change.

## License

Add your license information here.
