# Quality Gates and Contract Freeze

This document defines the enforced quality gates for stable API delivery.

## Required Checks

Every pull request must pass the following checks:

1. `pnpm lint`
2. `pnpm test:contract`
3. `pnpm openapi:lint`
4. `pnpm invariants:check --fail-on=critical`
5. Module-focused tests for touched code (`pnpm test` and/or `pnpm test:e2e` subsets)
6. Postman scenario validation with Newman (`pnpm postman:run`)
7. Frontend lint (`pnpm --dir ui lint`) for UI changes
8. Frontend production build (`pnpm --dir ui build`) for UI changes

`pnpm quality:gates` runs the core contract gate set (lint + contract test + OpenAPI lint).

GitHub Actions workflows enforcing these gates:

1. `Backend CI` in `.github/workflows/backend-ci.yml`
2. `Frontend CI` in `.github/workflows/frontend-ci.yml`

## Data Invariant Gate

Backend CI seeds the database after migrations, then runs:

```bash
pnpm invariants:check --fail-on=critical
```

The command checks every registered invariant for every tenant. It exits with
status `1` when a check throws, an incident fixture is not detected, or the
seeded database contains a violation at or above the requested threshold.
`--fail-on=warning` makes warnings fail too; `critical` leaves warnings visible
in the report without blocking the build.

Before checking the clean seed, the command exercises rollback-isolated
database fixtures for every write-path incident in the data-integrity epic:
first/last schedule time changes, weekday and recurring-range removal, ride
deactivation, SKIP and deleted ADDITIONAL exceptions, capacity reduction,
ride-line replacement, route reorder, boarding/drop-off changes, and station,
passenger, or line deactivation. Each fixture starts valid, applies the same
post-sale mutation as the incident, runs the registry, and requires the
responsible invariant to report the affected row. The transaction is always
rolled back, so fixture data never leaks into the clean-data check or a local
database.

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
