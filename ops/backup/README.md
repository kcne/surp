# Database backup

A daily `pg_dump` of the production database to S3-compatible storage, running as a separate Railway cron service.

This is the only net under production data. Railway Postgres runs no backups of its own here.

## How it is set up

| | |
|---|---|
| When | `0 1 * * *` UTC — 02:00 local in winter, 03:00 in summer |
| What | Full dump in custom format (`-Fc`), compressed |
| Where | `daily/` (30 days) and `monthly/` (365 days) |
| Permissions | `PutObject` only — the job cannot delete anything |

`pg_dump` reads from a single MVCC snapshot, so the dump is consistent even while reservations are being written. The quiet hour is chosen for load and for a cleaner recovery point, not for correctness.

## Where backups live

The script speaks plain S3 and does not care whose bucket it is. The provider is one variable — `BACKUP_S3_ENDPOINT`. Railway's own bucket, Tigris, Cloudflare R2, Backblaze B2 and AWS S3 all work.

Choosing a provider is really choosing what the backup is independent of:

| Location | Protects against | Does not protect against |
|---|---|---|
| Bucket at the same provider as the database | Bad migrations, dropped tables, database failure | Losing the account, a billing lapse, deleting the project, a provider-wide outage |
| Bucket at a different provider | All of the above | — |

For the failure this epic exists to prevent — **a migration or backfill corrupting data** — the same provider is entirely sufficient. That is also by far the most likely scenario.

Practical advice: take whatever you can set up **today**. A backup that exists at the same provider is worth far more than a perfect one that is still pending. A weekly copy elsewhere can be added later.

One **no**: a Railway Volume is not a backup target. It is not versioned, has no lifecycle rules, and shares the project's fate with the database. That is a copy, not a backup.

## Why a separate bucket and a separate key

Whatever the provider, backups do **not** share a bucket with ticket images (`enclosed-shoebox-uzuh-ovk`).

The application's key lives in an internet-facing web service and is the most likely thing to leak. A backup that key can delete is not a backup. This holds at every provider and is not a matter of preference.

The backup bucket gets its own key, and that key has no delete permission. Retention is handled entirely by lifecycle rules.

## Setup

### 1. Bucket and credentials

Create a new bucket (for example `surp-db-backups`) and an access key scoped **to that bucket only**, with `PutObject` and `GetObject`, without `DeleteObject`.

`GetObject` is needed for restores and for reading `latest.json`.

### 2. Lifecycle rules

These are the entire retention policy — the job deletes nothing:

| Prefix | Rule |
|---|---|
| `daily/` | Expire after 30 days |
| `monthly/` | Expire after 365 days |

Without these rules the bucket grows without bound. Set them before the first run.

### 3. Railway service

A new service in the same project as the database, so it reaches it over the private network:

- Root directory: `ops/backup`
- Builder: Dockerfile
- Cron schedule: `0 1 * * *`

Variables:

```
DATABASE_URL           = ${{Postgres.DATABASE_URL}}   # private network, not the public proxy
BACKUP_S3_BUCKET       = surp-db-backups
BACKUP_S3_ENDPOINT     = <bucket S3 endpoint>          # e.g. https://t3.storageapi.dev
AWS_ACCESS_KEY_ID      = <key scoped to the backup bucket>
AWS_SECRET_ACCESS_KEY  = <...>
AWS_DEFAULT_REGION     = auto
```

Reference the Postgres service for `DATABASE_URL` rather than pasting the public proxy URL, so the traffic never leaves Railway's network.

### 4. Trial run

Trigger the service manually and read the log. Expected:

```
[backup] dumping database
[backup] dump written: 2847362 bytes
[backup] verifying archive
[backup] archive verified: 184 entries
[backup] uploading s3://surp-db-backups/daily/surp-20260911T010000Z.dump
[backup] confirming upload
[backup] writing heartbeat
[backup] done: daily/surp-20260911T010000Z.dump (2847362 bytes, sha256 a3f9c1e8b204)
```

Every step that fails aborts the run with a non-zero exit. The job cannot partially succeed.

## Restore drill

**A backup nobody has restored is an assumption, not a net.** Run this drill once before the first migration from #15, and quarterly after that.

```bash
# A scratch database — the local docker-compose one is enough
docker compose -f api/docker-compose.yml up -d
createdb -h localhost -U postgres surp_restore_drill

export TARGET_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/surp_restore_drill'
export BACKUP_S3_BUCKET=surp-db-backups
export BACKUP_S3_ENDPOINT=<bucket S3 endpoint>
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

./ops/backup/restore.sh
```

The script ends by printing row counts per table. **Compare them against production** — `pg_restore` exiting zero is a weaker claim than it sounds.

The script refuses to write over a database whose URL looks like production. A real recovery has to say so explicitly:

```bash
ALLOW_PRODUCTION_RESTORE=yes-i-am-restoring-production ./ops/backup/restore.sh
```

## Real recovery

1. **Stop the API service** so nothing writes over the recovery in progress.
2. Find the recovery point: `aws s3 ls s3://surp-db-backups/daily/ --endpoint-url ...`
3. Restore into a **new** database, not over the existing one — the damaged database stays as evidence until the new one is confirmed good.
4. Check row counts and run the integrity checks from Settings.
5. Point `DATABASE_URL` at the new database, then bring the API back up.

Step 3 matters: restoring over a damaged database destroys the evidence of what happened along with the damage.

## Not here yet

- **An alert when a backup is missing.** `latest.json` carries the timestamp of the last successful backup; asserting it is younger than 26h belongs in #23, where an alerting channel already exists. Until then the backup needs a manual look.
- **Client-side encryption.** The dump holds passenger personal data — names, phone numbers, email addresses. Today we rely on the encryption the bucket applies itself. Encrypting under a key the provider never sees is stronger, but introduces key custody: a lost key means worthless backups. A separate decision.
