#!/usr/bin/env bash
#
# Daily PostgreSQL backup to S3-compatible storage.
#
# Runs as a Railway cron service, reaching the database over the private
# network so the database never needs a public endpoint.
#
# The job only ever adds objects. It holds no delete permission and performs no
# pruning: retention is a bucket lifecycle rule, so nothing in this system —
# including a bug in this script — can remove a backup.

set -euo pipefail

require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "FATAL: $name is required" >&2
    exit 1
  fi
}

require DATABASE_URL
require BACKUP_S3_BUCKET
require BACKUP_S3_ENDPOINT
require AWS_ACCESS_KEY_ID
require AWS_SECRET_ACCESS_KEY

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

# Railway skips a scheduled run while the previous one is still Active, so a
# dump that hangs does not fail loudly — it stops every future backup, quietly
# and indefinitely. Every step that can block on the network gets a ceiling.
readonly DUMP_TIMEOUT="${BACKUP_DUMP_TIMEOUT_SECONDS:-3600}"
readonly UPLOAD_TIMEOUT="${BACKUP_UPLOAD_TIMEOUT_SECONDS:-1800}"

readonly S3=(aws s3 --endpoint-url "$BACKUP_S3_ENDPOINT")
readonly S3API=(aws s3api --endpoint-url "$BACKUP_S3_ENDPOINT")

readonly STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
readonly DAY_OF_MONTH="$(date -u +%d)"
readonly FILE="surp-${STAMP}.dump"
readonly LOCAL="/tmp/${FILE}"

log() { echo "[backup] $(date -u +%H:%M:%S) $*"; }

cleanup() { rm -f "$LOCAL"; }
trap cleanup EXIT

# --- Version preflight ------------------------------------------------------
#
# pg_dump refuses to dump a server newer than itself, and an archive written by
# a newer pg_dump cannot be restored into an older server. pg_dump reports the
# two numbers when it aborts but not what to do about them, so check first and
# say where the fix lives.
#
# A server version we cannot read is not fatal: pg_dump is about to try anyway
# and will fail on its own terms.

readonly CLIENT_MAJOR="$(pg_dump --version | sed -E 's/.* ([0-9]+).*/\1/')"
SERVER_NUM="$(psql "$DATABASE_URL" -tAc 'show server_version_num' 2>/dev/null | tr -d ' ' || true)"

if [ -n "${SERVER_NUM:-}" ]; then
  readonly SERVER_MAJOR=$((SERVER_NUM / 10000))
  log "server major ${SERVER_MAJOR}, pg_dump major ${CLIENT_MAJOR}"

  if [ "$CLIENT_MAJOR" -lt "$SERVER_MAJOR" ]; then
    echo "FATAL: pg_dump ${CLIENT_MAJOR} cannot dump a PostgreSQL ${SERVER_MAJOR} server." >&2
    echo "       Set PG_MAJOR=${SERVER_MAJOR} in ops/backup/Dockerfile and redeploy." >&2
    exit 1
  fi

  # A client ahead of the server still dumps, but writes an archive the server
  # cannot restore — which only surfaces during a recovery.
  if [ "$CLIENT_MAJOR" -gt "$SERVER_MAJOR" ]; then
    echo "FATAL: pg_dump ${CLIENT_MAJOR} is ahead of the PostgreSQL ${SERVER_MAJOR} server." >&2
    echo "       The archive would not restore into it. Set PG_MAJOR=${SERVER_MAJOR}" >&2
    echo "       in ops/backup/Dockerfile and redeploy." >&2
    exit 1
  fi
else
  log "server version unavailable, letting pg_dump decide"
fi

# --- Dump -------------------------------------------------------------------
#
# Custom format (-Fc) is compressed and lets pg_restore pull out a single table
# during a partial recovery, which plain SQL cannot. Ownership and privileges
# are dropped so the dump restores into a scratch database under any role.
#
# pg_dump reads from one MVCC snapshot, so the result is consistent even while
# reservations are being written. The quiet hour is chosen for load and for a
# cleaner recovery point, not for correctness.

log "dumping database (timeout ${DUMP_TIMEOUT}s)"

if ! timeout "$DUMP_TIMEOUT" \
  pg_dump --format=custom --no-owner --no-privileges --file="$LOCAL" "$DATABASE_URL"; then
  echo "FATAL: pg_dump failed or exceeded ${DUMP_TIMEOUT}s" >&2
  exit 1
fi

readonly BYTES="$(wc -c < "$LOCAL" | tr -d ' ')"
log "dump written: ${BYTES} bytes"

if [ "$BYTES" -lt 1024 ]; then
  echo "FATAL: dump is ${BYTES} bytes, which cannot be a real database" >&2
  exit 1
fi

# --- Verify before sending --------------------------------------------------
#
# A truncated or corrupt dump uploads just as happily as a good one, and the
# failure only surfaces during a restore, when it is least welcome. Reading the
# archive's table of contents proves the file is a complete, parseable archive.

log "verifying archive"

if ! TOC="$(pg_restore --list "$LOCAL" 2>&1)"; then
  echo "FATAL: archive is not readable by pg_restore:" >&2
  echo "$TOC" >&2
  exit 1
fi

readonly TOC_ENTRIES="$(printf '%s\n' "$TOC" | grep -c '^[0-9]' || true)"

if [ "${TOC_ENTRIES:-0}" -lt 1 ]; then
  echo "FATAL: archive parses but holds no restorable entries" >&2
  exit 1
fi

log "archive verified: ${TOC_ENTRIES} entries"

readonly SHA="$(sha256sum "$LOCAL" | cut -d' ' -f1)"

# --- Upload -----------------------------------------------------------------
#
# Every backup lands under daily/. On the first of the month the same file is
# also written under monthly/, which carries a longer lifecycle. Two prefixes
# give two retention windows without the job ever deleting anything.

readonly DAILY_KEY="daily/${FILE}"
log "uploading s3://${BACKUP_S3_BUCKET}/${DAILY_KEY}"
timeout "$UPLOAD_TIMEOUT" "${S3[@]}" cp "$LOCAL" "s3://${BACKUP_S3_BUCKET}/${DAILY_KEY}"

if [ "$DAY_OF_MONTH" = "01" ]; then
  log "first of month, also uploading to monthly/"
  timeout "$UPLOAD_TIMEOUT" "${S3[@]}" cp "$LOCAL" "s3://${BACKUP_S3_BUCKET}/monthly/${FILE}"
fi

# --- Confirm it arrived whole -----------------------------------------------

log "confirming upload"
readonly REMOTE_BYTES="$(
  "${S3API[@]}" head-object --bucket "$BACKUP_S3_BUCKET" --key "$DAILY_KEY" \
    --query ContentLength --output text
)"

if [ "$REMOTE_BYTES" != "$BYTES" ]; then
  echo "FATAL: uploaded ${REMOTE_BYTES} bytes but dump is ${BYTES}" >&2
  exit 1
fi

# --- Heartbeat --------------------------------------------------------------
#
# One small object holding the state of the most recent successful backup. The
# freshness check reads this instead of listing the whole prefix, and a backup
# that quietly stops running shows up as a stale timestamp here.

log "writing heartbeat"
cat > /tmp/latest.json <<JSON
{
  "key": "${DAILY_KEY}",
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sizeBytes": ${BYTES},
  "sha256": "${SHA}",
  "tocEntries": ${TOC_ENTRIES}
}
JSON

"${S3[@]}" cp /tmp/latest.json "s3://${BACKUP_S3_BUCKET}/latest.json" --content-type application/json
rm -f /tmp/latest.json

log "done: ${DAILY_KEY} (${BYTES} bytes, sha256 ${SHA:0:12})"
