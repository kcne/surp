#!/usr/bin/env bash
#
# Control-flow tests for backup.sh, driven by stubbed pg_dump / pg_restore /
# aws on PATH.
#
# These do not prove a real dump round-trips — only a restore drill against the
# live database does that, and ops/backup/README.md says when to run one. What
# they do prove is that every guard in the script actually aborts the run, so a
# failed backup can never report success.
#
#   ./ops/backup/backup.test.sh

set -uo pipefail

readonly HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SUT="${HERE}/backup.sh"

PASS=0
FAIL=0

# --- Stub harness ------------------------------------------------------------

setup_stubs() {
  STUB_DIR="$(mktemp -d)"
  WORK_DIR="$(mktemp -d)"
  export STUB_DIR WORK_DIR

  # pg_dump writes a file of DUMP_BYTES bytes wherever --file points.
  cat > "${STUB_DIR}/pg_dump" <<'STUB'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
  echo "pg_dump (PostgreSQL) ${CLIENT_MAJOR:-18}.6"
  exit 0
fi
for arg in "$@"; do
  case "$arg" in --file=*) out="${arg#--file=}" ;; esac
done
echo "pg_dump $*" >> "${WORK_DIR}/calls"
if [ "${DUMP_HANGS:-0}" = "1" ]; then
  sleep 30
fi
head -c "${DUMP_BYTES:-4096}" /dev/zero > "$out"
STUB

  # pg_restore --list emits a table of contents, or fails if told to.
  cat > "${STUB_DIR}/pg_restore" <<'STUB'
#!/usr/bin/env bash
echo "pg_restore $*" >> "${WORK_DIR}/calls"
if [ "${RESTORE_FAILS:-0}" = "1" ]; then
  echo "pg_restore: error: did not find magic string in file header" >&2
  exit 1
fi
if [ "${RESTORE_EMPTY:-0}" = "1" ]; then
  echo ";"
  echo "; Archive created at 2026-09-11"
  exit 0
fi
echo ";"
echo "215; 1259 16456 TABLE public Reservation postgres"
echo "216; 1259 16457 TABLE public Line postgres"
exit 0
STUB

  # aws records every invocation; head-object reports REMOTE_BYTES.
  cat > "${STUB_DIR}/aws" <<'STUB'
#!/usr/bin/env bash
echo "aws $*" >> "${WORK_DIR}/calls"
for arg in "$@"; do
  if [ "$arg" = "head-object" ]; then
    echo "${REMOTE_BYTES:-${DUMP_BYTES:-4096}}"
    exit 0
  fi
done
exit 0
STUB

  # psql answers the server-version preflight.
  cat > "${STUB_DIR}/psql" <<'STUB'
#!/usr/bin/env bash
echo "psql $*" >> "${WORK_DIR}/calls"
if [ "${SERVER_UNREACHABLE:-0}" = "1" ]; then
  exit 1
fi
echo "${SERVER_MAJOR:-18}0006"
STUB

  # Alpine provides `timeout` via busybox, but macOS ships it as `gtimeout`.
  # A portable shim keeps the suite runnable on any host; what is under test is
  # that the script aborts when the ceiling is hit, not the utility itself.
  cat > "${STUB_DIR}/timeout" <<'STUB'
#!/usr/bin/env bash
secs="$1"; shift
"$@" &
pid=$!
( sleep "$secs"; kill -9 "$pid" 2>/dev/null ) &
watcher=$!
wait "$pid" 2>/dev/null
rc=$?
kill -9 "$watcher" 2>/dev/null
wait "$watcher" 2>/dev/null
exit "$rc"
STUB

  chmod +x "${STUB_DIR}"/*
  : > "${WORK_DIR}/calls"

  export PATH="${STUB_DIR}:${PATH}"
  export DATABASE_URL="postgresql://stub/db"
  export BACKUP_S3_BUCKET="test-bucket"
  export BACKUP_S3_ENDPOINT="https://stub.invalid"
  export AWS_ACCESS_KEY_ID="stub"
  export AWS_SECRET_ACCESS_KEY="stub"
}

teardown_stubs() {
  PATH="${PATH#"${STUB_DIR}":}"
  rm -rf "$STUB_DIR" "$WORK_DIR"
  unset DUMP_BYTES REMOTE_BYTES RESTORE_FAILS RESTORE_EMPTY DUMP_HANGS
  unset BACKUP_DUMP_TIMEOUT_SECONDS CLIENT_MAJOR SERVER_MAJOR SERVER_UNREACHABLE
  unset DATABASE_URL BACKUP_S3_BUCKET BACKUP_S3_ENDPOINT
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
}

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    echo "  ok    ${name}"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL  ${name} (expected exit ${expected}, got ${actual})"
  fi
}

run_sut() {
  bash "$SUT" > "${WORK_DIR}/out" 2>&1
  echo $?
}

# --- Tests -------------------------------------------------------------------

echo "backup.sh"

setup_stubs
check "succeeds on a healthy dump" 0 "$(run_sut)"
grep -q 'aws s3 .*cp .*daily/surp-.*\.dump' "${WORK_DIR}/calls" \
  && { PASS=$((PASS+1)); echo "  ok    uploads under daily/"; } \
  || { FAIL=$((FAIL+1)); echo "  FAIL  uploads under daily/"; }
grep -q 'latest\.json' "${WORK_DIR}/calls" \
  && { PASS=$((PASS+1)); echo "  ok    writes the heartbeat"; } \
  || { FAIL=$((FAIL+1)); echo "  FAIL  writes the heartbeat"; }
grep -q "aws s3api .*head-object" "${WORK_DIR}/calls" \
  && { PASS=$((PASS+1)); echo "  ok    confirms the upload"; } \
  || { FAIL=$((FAIL+1)); echo "  FAIL  confirms the upload"; }
teardown_stubs

# A backup job that uploads nothing must not exit 0 — that is the one outcome
# that would let a silent failure look like a working backup.
setup_stubs
unset DATABASE_URL
check "refuses to run without DATABASE_URL" 1 "$(run_sut)"
teardown_stubs

setup_stubs
unset BACKUP_S3_BUCKET
check "refuses to run without a bucket" 1 "$(run_sut)"
teardown_stubs

setup_stubs
export DUMP_BYTES=100
check "rejects an implausibly small dump" 1 "$(run_sut)"
teardown_stubs

setup_stubs
export RESTORE_FAILS=1
check "rejects a dump pg_restore cannot parse" 1 "$(run_sut)"
teardown_stubs

setup_stubs
export RESTORE_EMPTY=1
check "rejects an archive with no restorable entries" 1 "$(run_sut)"
teardown_stubs

setup_stubs
export DUMP_BYTES=4096 REMOTE_BYTES=2048
check "rejects a truncated upload" 1 "$(run_sut)"
teardown_stubs

# A truncated upload must not leave a heartbeat claiming success behind it.
setup_stubs
export DUMP_BYTES=4096 REMOTE_BYTES=2048
run_sut > /dev/null
grep -q 'latest\.json' "${WORK_DIR}/calls" \
  && { FAIL=$((FAIL+1)); echo "  FAIL  no heartbeat after a failed upload"; } \
  || { PASS=$((PASS+1)); echo "  ok    no heartbeat after a failed upload"; }
teardown_stubs

# Railway skips a scheduled run while the previous one is still Active, so a
# hung dump would stop every future backup rather than failing one. The ceiling
# has to turn that into a loud failure.
setup_stubs
export DUMP_HANGS=1 BACKUP_DUMP_TIMEOUT_SECONDS=1
check "aborts a dump that hangs past its timeout" 1 "$(run_sut)"
teardown_stubs

# Production runs a different major version than the local and CI databases,
# which is how the first deploy shipped a pg_dump that could not read the
# server. The preflight has to name the fix, not just fail.
setup_stubs
export CLIENT_MAJOR=16 SERVER_MAJOR=18
check "refuses a pg_dump older than the server" 1 "$(run_sut)"
grep -q 'PG_MAJOR=18 in ops/backup/Dockerfile' "${WORK_DIR}/out" \
  && { PASS=$((PASS+1)); echo "  ok    names the fix for an old client"; } \
  || { FAIL=$((FAIL+1)); echo "  FAIL  names the fix for an old client"; }
teardown_stubs

# A client ahead of the server dumps happily and writes an archive the server
# cannot restore — a failure that would only appear during a recovery.
setup_stubs
export CLIENT_MAJOR=18 SERVER_MAJOR=16
check "refuses a pg_dump newer than the server" 1 "$(run_sut)"
teardown_stubs

setup_stubs
export CLIENT_MAJOR=18 SERVER_MAJOR=18
check "proceeds when the majors match" 0 "$(run_sut)"
teardown_stubs

# An unreachable server must not block the backup on the preflight alone;
# pg_dump is about to try anyway and fails on its own terms.
setup_stubs
export SERVER_UNREACHABLE=1
check "continues when the server version cannot be read" 0 "$(run_sut)"
teardown_stubs

echo
echo "${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
