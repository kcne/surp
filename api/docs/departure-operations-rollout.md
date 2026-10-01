# Departure operations rollout and rollback (#27, PR 3d)

No schema migration is included. Departures own cancellation, extra times and
extra capacity. SKIP and ADDITIONAL rows mirror cancellations and times for the
existing ride readers. Capacity has no equivalent column on RideException.

## Prepare the rollback build before deploying 3d

The original 3c build is **not a safe rollback target** after an extra's capacity
differs from its ride's. Its full sync resets linked extras to the ride capacity,
which can invalidate seats already sold. Keeping exception rows cannot prevent
this. Rolling replicas running that original build must be drained before 3d
operations are enabled.

Build a compatible 3c rollback version from `85028222`, applying the checked-in
patch from this PR (from the repository root):

```sh
git apply --check /path/to/3d/ops/rollback/departure-extra-capacity-3c.patch
git apply /path/to/3d/ops/rollback/departure-extra-capacity-3c.patch
pnpm --dir api lint
pnpm --dir api exec tsc --noEmit
pnpm --dir api test --runInBand --runTestsByPath src/departures/departure-sync.spec.ts
pnpm --dir api build
```

Retain that build as the rollback target. The patch changes only the extra-capacity
ownership rule; it does not add departure-operation endpoints or require a schema
change. It is also required on any older replica overlapping the 3d rollout.

## Rehearsal gate on an isolated restored database

1. With 3d, create an extra at capacity 60 on a 48-seat ride. Book seat 55 and
   also retain a cancelled reservation linked to the extra.
2. Cancel/restore the timetable bus and extra, and edit the extra's times. Confirm
   refusals where applicable. Check the exception mirror after each operation.
3. Run the compatible 3c build on that restore. Perform an unrelated timetable
   edit to force a **full** sync; an insert-only nightly run is insufficient.
4. Verify the extra still has the same ID, capacity 60 and operator times, seat
   55 remains linked, and both departure checks remain clean. Repeat a full sync
   to verify the state stays unchanged.
5. Return to 3d and verify those values again.

Do not reset capacity to make rollback checks pass. If the compatible build or
this rehearsal is unavailable, keep 3d running and fix forward; do not roll back
to the original 3c binary. This procedure is a deployment gate, not an assertion
that a production-dump rehearsal has already been run.
