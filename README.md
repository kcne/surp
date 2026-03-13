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

## Contributing

- Keep changes focused and small.
- Add tests for new behavior and at least one failure path.
- Update API docs and Postman collection when endpoints change.

## License

Add your license information here.
