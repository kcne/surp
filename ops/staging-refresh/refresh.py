"""Weekly production-backup restore, confined to SURP staging."""

import hashlib
import json
import os
import subprocess
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import psycopg2
from psycopg2 import sql


STAGING_ENVIRONMENT_ID = "dda2e244-4c5e-42d2-8af1-1af03fad458a"
DATABASE_MARKER = "surp-staging-refresh"
COMMAND_TIMEOUT = 3600


def log(message):
    print(f"[staging-refresh] {message}", flush=True)


def command(args, *, env=None):
    # Suppress tool output: restored rows and connection strings can be sensitive.
    result = subprocess.run(args, env=env, capture_output=True, timeout=COMMAND_TIMEOUT)
    if result.returncode:
        raise RuntimeError(f"{args[0]} failed (exit {result.returncode}); staging was not promoted")
    return result.stdout


def database_url(url, name):
    parts = urlsplit(url)
    return urlunsplit(parts._replace(path="/" + quote(name, safe="")))


def validate_environment(env):
    if env.get("RAILWAY_ENVIRONMENT_ID") != STAGING_ENVIRONMENT_ID:
        raise RuntimeError("Refresh is allowed only in the SURP staging environment")
    for key in ("TARGET_DATABASE_URL", "EXPECTED_STAGING_SYSTEM_IDENTIFIER",
                "BACKUP_S3_BUCKET", "BACKUP_S3_ENDPOINT", "AWS_ACCESS_KEY_ID",
                "AWS_SECRET_ACCESS_KEY"):
        if not env.get(key):
            raise RuntimeError(f"{key} is required")
    parts = urlsplit(env["TARGET_DATABASE_URL"])
    name = unquote(parts.path.lstrip("/"))
    if parts.scheme not in ("postgres", "postgresql") or not parts.hostname:
        raise RuntimeError("Invalid staging database URL")
    if not name or name in ("postgres", "template0", "template1") or len(name.encode()) > 40:
        raise RuntimeError("Unsafe staging database name")
    if not env["BACKUP_S3_ENDPOINT"].startswith("https://"):
        raise RuntimeError("Production backup storage requires HTTPS")
    return name


def download_backup(env, directory):
    aws = ["aws", "--endpoint-url", env["BACKUP_S3_ENDPOINT"], "s3", "cp"]
    bucket = env["BACKUP_S3_BUCKET"]
    metadata = json.loads(command(aws + [f"s3://{bucket}/latest.json", "-"], env=env))
    key = metadata["key"]
    if not isinstance(key, str) or not key.startswith("daily/") or not key.endswith(".dump"):
        raise RuntimeError("Backup manifest does not identify a daily dump")
    completed = datetime.fromisoformat(metadata["completedAt"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - completed).total_seconds()
    if not 0 <= age <= 26 * 3600:
        raise RuntimeError("Production backup is stale or has a future timestamp")
    archive = directory / "production.dump"
    command(aws + [f"s3://{bucket}/{key}", str(archive)], env=env)
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if archive.stat().st_size != metadata["sizeBytes"] or digest.hexdigest() != metadata["sha256"]:
        raise RuntimeError("Production backup size/checksum verification failed")
    if not command(["pg_restore", "--list", str(archive)]).strip():
        raise RuntimeError("Production backup is empty")
    log("Verified fresh production backup and SHA-256")
    return archive


def drop_owned_database(cursor, name):
    cursor.execute("SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = %s", (name,))
    row = cursor.fetchone()
    if row is None:
        return
    if row[0] != DATABASE_MARKER:
        raise RuntimeError("Refusing to remove an unowned refresh/rollback database")
    cursor.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


def promote_database(connection, cursor, target, candidate, previous):
    # Connection blocking is transactional too: even a lost job connection
    # rolls it back, rather than stranding the original database offline.
    connection.autocommit = False
    with connection:
        cursor.execute(sql.SQL("ALTER DATABASE {} ALLOW_CONNECTIONS false").format(sql.Identifier(target)))
        cursor.execute("SELECT pg_terminate_backend(pid, 10000) FROM pg_stat_activity WHERE datname = %s", (target,))
        cursor.execute(sql.SQL("ALTER DATABASE {} RENAME TO {}").format(sql.Identifier(target), sql.Identifier(previous)))
        cursor.execute(sql.SQL("COMMENT ON DATABASE {} IS %s").format(sql.Identifier(previous)), (DATABASE_MARKER,))
        cursor.execute(sql.SQL("ALTER DATABASE {} RENAME TO {}").format(sql.Identifier(candidate), sql.Identifier(target)))
    connection.autocommit = True


def run_refresh(env):
    target = validate_environment(env)
    candidate, previous = target + "_refresh", target + "_previous"
    target_url = env["TARGET_DATABASE_URL"]
    # A maintenance connection survives target connection termination and owns
    # the advisory lock for the entire refresh, including restore/migrations.
    with closing(psycopg2.connect(database_url(target_url, "postgres"), connect_timeout=15,
                                 options="-c statement_timeout=60000 -c lock_timeout=15000")) as connection:
        connection.autocommit = True
        with connection.cursor() as cursor:
            cursor.execute("SELECT system_identifier::text FROM pg_control_system()")
            if cursor.fetchone()[0] != env["EXPECTED_STAGING_SYSTEM_IDENTIFIER"]:
                raise RuntimeError("Target PostgreSQL server is not the pinned staging server")
            cursor.execute("SELECT pg_try_advisory_lock(743920261001)")
            if not cursor.fetchone()[0]:
                raise RuntimeError("Another staging refresh is already running")
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target,))
            if cursor.fetchone() is None:
                raise RuntimeError("Staging database does not exist")
            with tempfile.TemporaryDirectory(prefix="staging-refresh-") as directory:
                archive = download_backup(env, Path(directory))
                drop_owned_database(cursor, candidate)
                cursor.execute(sql.SQL("CREATE DATABASE {} TEMPLATE template0").format(sql.Identifier(candidate)))
                cursor.execute(sql.SQL("COMMENT ON DATABASE {} IS %s").format(sql.Identifier(candidate)), (DATABASE_MARKER,))
                candidate_url = database_url(target_url, candidate)
                tool_env = dict(env, PGDATABASE=candidate_url, PGCONNECT_TIMEOUT="15")
                log("Restoring replacement database; current staging remains available")
                command(["pg_restore", "--no-owner", "--no-privileges", "--exit-on-error",
                         "--single-transaction", "--dbname", candidate_url, str(archive)], env=tool_env)
                log("Applying rolling Prisma migrations to replacement")
                command(["pnpm", "prisma:migrate:deploy"], env=dict(env, DATABASE_URL=candidate_url))
                with closing(psycopg2.connect(candidate_url, connect_timeout=15,
                                             options="-c statement_timeout=60000 -c lock_timeout=15000")) as restored, restored:
                    with restored.cursor() as check:
                        # A copied refresh token must not carry a production
                        # session into staging. Password hashes remain unchanged.
                        check.execute('DELETE FROM "RefreshSession"')
                        check.execute('SELECT count(*) FROM "Tenant"')
                        if check.fetchone()[0] == 0:
                            raise RuntimeError("Replacement has no tenants")
                        check.execute('SELECT count(*) FROM "User"')
                        if check.fetchone()[0] == 0:
                            raise RuntimeError("Replacement has no users")
                        check.execute('SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL')
                        if check.fetchone()[0] != 0:
                            raise RuntimeError("Replacement has unfinished migrations")
                # Remove only this job's older rollback, after validation. The
                # currently serving database becomes the new rollback copy.
                drop_owned_database(cursor, previous)
                log("Promoting replacement; staging connections will briefly reconnect")
                promote_database(connection, cursor, target, candidate, previous)
                log("Refresh complete; previous staging database retained for rollback")


if __name__ == "__main__":
    try:
        run_refresh(dict(os.environ))
    except Exception as error:
        # Avoid logging PostgreSQL details, restored customer data, or secrets.
        if isinstance(error, RuntimeError):
            log(str(error))
        else:
            log(f"Refresh failed ({type(error).__name__}); inspect job and database state")
        raise SystemExit(1)
