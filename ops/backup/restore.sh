#!/usr/bin/env bash
#
# Restore a backup into a scratch database.
#
# This exists to be run before it is needed. A backup nobody has restored is an
# assumption, not a safety net — and the drill is also what step 4 of the epic's
# working rules requires before any production backfill.
#
#   ./restore.sh                      # newest daily backup -> scratch database
#   ./restore.sh daily/surp-2026....dump
#
# TARGET_DATABASE_URL must point at a database you are willing to lose. The
# script refuses to touch anything that looks like production.

set -euo pipefail

require() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "FATAL: $name is required" >&2
    exit 1
  fi
}

require TARGET_DATABASE_URL
require BACKUP_S3_BUCKET
require BACKUP_S3_ENDPOINT
require AWS_ACCESS_KEY_ID
require AWS_SECRET_ACCESS_KEY

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

readonly S3="aws s3 --endpoint-url ${BACKUP_S3_ENDPOINT}"

log() { echo "[restore] $*"; }

# --- Refuse to restore over production ---------------------------------------
#
# The whole point of a drill is that it is safe to repeat. Restoring into the
# live database by a slip of an environment variable would turn the safety net
# into the incident.

if [ "${ALLOW_PRODUCTION_RESTORE:-}" != "yes-i-am-restoring-production" ]; then
  case "$TARGET_DATABASE_URL" in
    *prod*|*railway*)
      echo "FATAL: TARGET_DATABASE_URL looks like production." >&2
      echo "       For a real recovery, set:" >&2
      echo "       ALLOW_PRODUCTION_RESTORE=yes-i-am-restoring-production" >&2
      exit 1
      ;;
  esac
fi

# --- Pick the archive --------------------------------------------------------

KEY="${1:-}"

if [ -z "$KEY" ]; then
  log "no key given, reading latest.json"
  KEY="$(
    $S3 cp "s3://${BACKUP_S3_BUCKET}/latest.json" - \
      | grep '"key"' | cut -d'"' -f4
  )"
  log "latest backup is ${KEY}"
fi

readonly LOCAL="/tmp/$(basename "$KEY")"

log "downloading ${KEY}"
$S3 cp "s3://${BACKUP_S3_BUCKET}/${KEY}" "$LOCAL"

log "verifying archive"
pg_restore --list "$LOCAL" > /dev/null
log "archive is readable"

# --- Restore -----------------------------------------------------------------
#
# --clean --if-exists makes the drill repeatable against the same scratch
# database. Errors are not suppressed: a restore that reports problems is the
# finding the drill exists to produce.

log "restoring into target database"
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --exit-on-error \
  "$LOCAL"

log "restore complete"

# --- Prove the data is actually there ----------------------------------------
#
# "pg_restore exited 0" is weaker than it sounds. Counting the rows that matter
# is what turns the drill into evidence.

log "row counts in restored database:"
psql "$TARGET_DATABASE_URL" --no-psqlrc --tuples-only --command "
  SELECT format('  %-14s %s', table_name, row_count) FROM (
    SELECT 'tenants'      AS table_name, count(*) AS row_count FROM \"Tenant\"
    UNION ALL SELECT 'stations',     count(*) FROM \"Station\"
    UNION ALL SELECT 'lines',        count(*) FROM \"Line\"
    UNION ALL SELECT 'rides',        count(*) FROM \"Ride\"
    UNION ALL SELECT 'passengers',   count(*) FROM \"Passenger\"
    UNION ALL SELECT 'reservations', count(*) FROM \"Reservation\"
  ) counts;
"

rm -f "$LOCAL"
log "drill finished — compare the counts above against production"
