# Required reservation departures rollout

Deploy the three migrations in order, before starting the updated API. Run
`reservation.departureLinked` and confirm zero null `Reservation.departureId`
values immediately before deployment.

1. `20261005120000` counts unlinked reservations and refuses them before any
   schema change. It adds a non-null check without scanning the table under
   the exclusive lock, then commits. New null writes are refused from here.
2. `20261005120100` validates existing rows under `SHARE UPDATE EXCLUSIVE`,
   which permits ordinary reads and writes, then commits.
3. `20261005120200` sets the column to `NOT NULL` using the validated check to
   avoid another table scan, then drops the helper check and commits.

Each stage bounds lock acquisition to 10 seconds. The first and last stages
still require brief exclusive locks. If a stage fails, its transaction rolls
back; preceding stages remain committed. Diagnose the failure, mark only the
failed migration rolled back with Prisma's migration resolution command, and
retry deployment. Do not resolve an unapplied stage as applied.

These replace the original **unreleased** migration. A rehearsal database
that already applied the original must be recreated; do not edit migration
history on a deployed database.

For rollback after all stages, run:

```sql
ALTER TABLE "Reservation" ALTER COLUMN "departureId" DROP NOT NULL;
```

For rollback during stages 1 or 2, instead drop
`"Reservation_departureId_not_null"`. Roll back the application together with
these constraints only if null writes are required. No reservation rows are
rewritten or deleted by the migrations.
