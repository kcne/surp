# API-Ready UI Seam Checklist

Use this checklist before swapping mocked/store-backed flows to API-backed calls.

## Contracts and Types

- [ ] Keep DTO/view-model mapping in one place per feature.
- [ ] Confirm UI types align with API response/request shapes.
- [ ] Avoid leaking transport-specific fields into presentational components.

## Data Access Boundaries

- [ ] Route all fetch/mutation calls through one feature boundary (store/service adapter).
- [ ] Ensure page and presentational components do not call network clients directly.
- [ ] Keep retry/loading/error state handling centralized.

## Forms and Mutations

- [ ] Validate payload shape through zod before mutation dispatch.
- [ ] Normalize server validation errors to form field errors.
- [ ] Ensure optimistic UI behavior is explicit and reversible.

## Tables and Lists

- [ ] Define server-side vs client-side filtering/sorting strategy per table.
- [ ] Preserve pagination contract (`page`, `pageSize`, `total`) where needed.
- [ ] Keep row action handlers API-agnostic at component level.

## Reservation-Specific Seams

- [ ] Preserve seat conflict handling rules when moving to API checks.
- [ ] Keep return-ticket pairing logic in shared helpers/hooks.
- [ ] Validate multi-seat flows against backend transaction semantics.

## UX and Resilience

- [ ] Show user-friendly fallback states for loading/empty/error.
- [ ] Keep destructive action confirmations in place.
- [ ] Ensure export/download flows still work with API data sources.

## Verification

- [ ] Run `pnpm lint` in `ui`.
- [ ] Manually smoke key routes:
  - [ ] `/reservations`
  - [ ] `/reservations/[rideInstanceId]`
  - [ ] modal create/edit/cancel flows
- [ ] Verify no store API changes were required for UI modularization.
