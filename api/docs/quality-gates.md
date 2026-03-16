# Quality Gates and Contract Freeze

This document defines the enforced quality gates for stable API delivery.

## Required Checks

Every pull request must pass the following checks:

1. `pnpm lint`
2. `pnpm test:contract`
3. `pnpm openapi:lint`
4. Module-focused tests for touched code (`pnpm test` and/or `pnpm test:e2e` subsets)
5. Postman scenario validation with Newman (`pnpm postman:run`)
6. Frontend lint (`pnpm --dir ui lint`) for UI changes
7. Frontend production build (`pnpm --dir ui build`) for UI changes

`pnpm quality:gates` runs the core contract gate set (lint + contract test + OpenAPI lint).

GitHub Actions workflows enforcing these gates:

1. `Backend CI` in `.github/workflows/backend-ci.yml`
2. `Frontend CI` in `.github/workflows/frontend-ci.yml`

## OpenAPI Contract Freeze Policy

- Source of truth for contract is `docs/openapi.json`.
- Update `docs/openapi.json` via `pnpm openapi:generate` whenever API contracts change.
- `pnpm openapi:lint` must pass before merge.

## Breaking Change Policy

A breaking change requires a version bump in `src/config/swagger.config.ts` (`OPENAPI_VERSION`) and release notes.

Breaking change examples:

1. Remove or rename endpoint/path.
2. Remove required request field.
3. Change response field type in a non-backward-compatible way.
4. Tighten validation that causes previously valid payloads to fail.

## Postman Runner Policy

- Postman collection source of truth: `postman/surp-api.postman_collection.json`.
- Local environment: `postman/surp-api.local.postman_environment.json`.
- Staging environment: `postman/surp-api.staging.postman_environment.json`.
- Include and maintain negative-path scenarios in folder `Negative Scenarios`.
