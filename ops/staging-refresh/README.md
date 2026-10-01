# Weekly staging database refresh

This implementation does not create or enable a Railway service on merge.
Configure a dedicated service only in staging after review, with a read-only
production-backup key. Run it once and verify API health and login before
considering the refresh operational. Subsequent runs use the cron schedule.
Deployment/source changes can also start a run, so treat deployment as a
potential staging data replacement, not just an image build.

Railway cron service: `staging-refresh`, staging only. Schedule: `0 3 * * 0`
(Sunday 03:00 UTC), after production's daily 01:00 UTC backup. Each refresh
replaces staging edits with an exact production snapshot. Production password
hashes and customer data are copied intentionally; refresh sessions are cleared
to prevent production refresh tokens being usable on staging. Keep staging email
credentials absent and application schedules disabled.

The job reads `latest.json` and its dump from **production's** backup bucket;
staging's backup bucket contains staging data and is not the source. It never
connects to the production database or writes/deletes backup objects.

## Railway configuration

- Source: `kcne/surp`, branch `rolling`, repository root.
- Builder: Dockerfile, path `ops/staging-refresh/Dockerfile`.
- Watch paths: `/ops/staging-refresh/**`, `/api/prisma/**`,
  `/api/package.json`, `/api/pnpm-lock.yaml`.
- Cron: `0 3 * * 0`; restart policy `NEVER`.
- Start: `timeout 14400 python3 /app/refresh/refresh.py` (four-hour ceiling).
- `TARGET_DATABASE_URL=${{Postgres.DATABASE_URL}}` in **staging**.
- `EXPECTED_STAGING_SYSTEM_IDENTIFIER`: pin from the staging PostgreSQL
  server's `SELECT system_identifier::text FROM pg_control_system()`.
- `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION=auto`: production backup
  storage credentials. Use a dedicated bucket-scoped read-only key, not a writer
  key; the script only invokes S3 reads. Never reference staging's bucket as the
  production source. Keep these variables on this cron service only.

Railway's environment UUID and the pinned PostgreSQL system identifier both
must match staging. Recreating the staging PostgreSQL volume requires checking
the new server and updating its pin. Database credentials require permission to
create/rename databases, terminate staging sessions, and read `pg_control_system`.

## Restore and promotion

1. Acquire a PostgreSQL advisory lock to prevent overlapping refreshes.
2. Require a production backup younger than 26 hours; verify size, SHA-256 and
   archive readability before changing any database.
3. Restore into `<database>_refresh` in a single transaction.
4. Apply the Prisma migrations packaged from `rolling`, clear refresh sessions,
   and check tenants/users and migration completion.
5. Block connections to the old copy and terminate existing ones; rename
   the serving database to `<database>_previous` and the replacement to the
   original name in one transaction. The API reconnects using its existing URL.

A failed restore/migration leaves the serving database unchanged. A failed
promotion rolls back both renames and connection blocking, including if the
job loses its PostgreSQL connection. A racing API reconnect can abort promotion;
the original staging database stays usable and the run must be retried.
The previous database is retained with connections disabled. A future successful
refresh removes only that job-owned rollback copy. Allow space for three
databases during preparation (current, replacement, previous), plus the dump in
the cron container. The job refuses to delete pre-existing unmarked databases.
No schema migration or API contract change is introduced by this automation.

## Manual rollback

Stop refresh runs first. Connect to staging's `postgres` maintenance database,
not `railway`, and confirm the retained `railway_previous` is the desired copy.
Temporarily block and terminate connections to `railway`, rename it to a new
unused diagnostic name, rename `railway_previous` to `railway`, and enable
connections on `railway`. Perform the two renames in one transaction. This
preserves the rejected copy for investigation. Verify API health and login.
Substitute the actual database name if staging is not named `railway`.

## Verification

Build from the repository root:

```sh
docker build -f ops/staging-refresh/Dockerfile -t surp-staging-refresh .
docker run --rm --entrypoint python3 surp-staging-refresh \
  -m unittest discover -s /app/refresh -p 'test_*.py' -v
```

The `Staging refresh CI` workflow builds the image and runs the integration tests
against a disposable PostgreSQL 18 server, then exercises the actual Prisma
migrations. It performs no Railway deployment or production database access.

Integration tests require a **disposable** PostgreSQL 18 server. Pass
`TEST_DATABASE_URL` to the test container. Tests create and drop the fixed
databases `refresh_fixture` and `refresh_source` (and refresh/rollback copies),
so never point this setting at a shared server. They exercise real archive
restore, database promotion, a repeat refresh, migration/promotion failure preservation,
server pinning, and concurrent-run rejection. The test migration is synthetic;
the first real scheduled/run-now job must verify the production dump against
the actual `rolling` migrations before declaring the live refresh proven.
