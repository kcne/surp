import hashlib
import json
import os
import tempfile
import unittest
from urllib.parse import urlsplit
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import psycopg2
from psycopg2 import sql

import refresh


def environment(url="postgresql://postgres:secret@staging/railway"):
    return {
        **os.environ,
        "RAILWAY_ENVIRONMENT_ID": refresh.STAGING_ENVIRONMENT_ID,
        "TARGET_DATABASE_URL": url,
        "EXPECTED_STAGING_SYSTEM_IDENTIFIER": "123",
        "BACKUP_S3_BUCKET": "production-backups",
        "BACKUP_S3_ENDPOINT": "https://storage.example.com",
        "AWS_ACCESS_KEY_ID": "test",
        "AWS_SECRET_ACCESS_KEY": "test",
    }


class GuardTests(unittest.TestCase):
    def test_refuses_production_or_missing_environment(self):
        for value in ("production", "", "d153a552-f8eb-471d-8a42-c8c6ed4ff70e"):
            with self.subTest(value=value), patch.object(refresh.psycopg2, "connect") as connect:
                with self.assertRaises(RuntimeError):
                    refresh.run_refresh(dict(environment(), RAILWAY_ENVIRONMENT_ID=value))
                connect.assert_not_called()

    def test_refuses_maintenance_database_and_non_https_storage(self):
        with self.assertRaises(RuntimeError):
            refresh.validate_environment(environment("postgresql://postgres:secret@staging/postgres"))
        with self.assertRaises(RuntimeError):
            refresh.validate_environment(dict(environment(), BACKUP_S3_ENDPOINT="http://storage.example.com"))

    def test_stale_or_corrupt_backup_fails_before_restore(self):
        payload = b"archive"
        now = datetime.now(timezone.utc)
        for completed, checksum in ((now - timedelta(days=2), hashlib.sha256(payload).hexdigest()),
                                    (now, "0" * 64)):
            manifest = {"key": "daily/test.dump", "completedAt": completed.isoformat(),
                        "sizeBytes": len(payload), "sha256": checksum}

            def fake_command(args, **kwargs):
                if args[-1] == "-":
                    return json.dumps(manifest).encode()
                Path(args[-1]).write_bytes(payload)
                return b""

            with tempfile.TemporaryDirectory() as directory, patch.object(refresh, "command", fake_command):
                with self.assertRaises(RuntimeError):
                    refresh.download_backup(environment(), Path(directory))


@unittest.skipUnless(os.environ.get("TEST_DATABASE_URL"), "disposable PostgreSQL not configured")
class DatabaseTests(unittest.TestCase):
    def setUp(self):
        if urlsplit(os.environ["TEST_DATABASE_URL"]).hostname != "refresh-test-db":
            raise RuntimeError("Integration tests require the disposable refresh-test-db container")
        self.admin_url = refresh.database_url(os.environ["TEST_DATABASE_URL"], "postgres")
        self.target = "refresh_fixture"
        self.source = "refresh_source"
        self.env = environment(refresh.database_url(self.admin_url, self.target))
        self.directory = tempfile.TemporaryDirectory()
        self.archive = Path(self.directory.name) / "test.dump"
        with closing(psycopg2.connect(self.admin_url)) as connection:
            connection.autocommit = True
            with connection.cursor() as cursor:
                cursor.execute("SELECT system_identifier::text FROM pg_control_system()")
                self.env["EXPECTED_STAGING_SYSTEM_IDENTIFIER"] = cursor.fetchone()[0]
                for name in (self.source, self.target):
                    cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        for name, label in ((self.target, "staging"), (self.source, "production")):
            with closing(psycopg2.connect(refresh.database_url(self.admin_url, name))) as connection, connection:
                with connection.cursor() as cursor:
                    cursor.execute('CREATE TABLE "Tenant" (id text); CREATE TABLE "User" (id text);'
                                   'CREATE TABLE "RefreshSession" (id text);'
                                   'CREATE TABLE "_prisma_migrations" (finished_at timestamptz, rolled_back_at timestamptz)')
                    cursor.execute('INSERT INTO "Tenant" VALUES (%s); INSERT INTO "User" VALUES (%s);'
                                   'INSERT INTO "RefreshSession" VALUES (%s)', (label, label, label))
        refresh.command(["pg_dump", "--format=custom", "--no-owner", "--no-privileges",
                         "--file=" + str(self.archive), refresh.database_url(self.admin_url, self.source)])

    def tearDown(self):
        with closing(psycopg2.connect(self.admin_url)) as connection:
            connection.autocommit = True
            with connection.cursor() as cursor:
                for name in (self.target, self.target + "_refresh", self.target + "_previous", self.source):
                    cursor.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))
        self.directory.cleanup()

    def run_job(self, fail_migration=False):
        real_command = refresh.command

        def command(args, *, env=None):
            if args[0] != "pnpm":
                return real_command(args, env=env)
            if fail_migration:
                raise RuntimeError("migration failed")
            with closing(psycopg2.connect(env["DATABASE_URL"])) as connection, connection:
                with connection.cursor() as cursor:
                    cursor.execute("CREATE TABLE rolling_migration (id integer)")
            return b""

        with patch.object(refresh, "download_backup", return_value=self.archive), patch.object(refresh, "command", command):
            refresh.run_refresh(self.env)

    def test_restore_migrate_swap_and_repeat_with_rollback(self):
        with closing(psycopg2.connect(self.env["TARGET_DATABASE_URL"])) as old_client:
            self.run_job()
            with self.assertRaises(psycopg2.Error):
                with old_client.cursor() as cursor:
                    cursor.execute("SELECT 1")
        self.run_job()  # Only the job-owned old rollback may be replaced.
        with closing(psycopg2.connect(self.env["TARGET_DATABASE_URL"])) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT id FROM "Tenant"')
                self.assertEqual(cursor.fetchone()[0], "production")
                cursor.execute('SELECT count(*) FROM "RefreshSession"')
                self.assertEqual(cursor.fetchone()[0], 0)
                cursor.execute("SELECT count(*) FROM rolling_migration")
                self.assertEqual(cursor.fetchone()[0], 0)
        with closing(psycopg2.connect(self.admin_url)) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT datallowconn, shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = %s",
                               (self.target + "_previous",))
                self.assertEqual(cursor.fetchone(), (False, refresh.DATABASE_MARKER))

    def test_failed_migration_preserves_serving_database(self):
        with self.assertRaises(RuntimeError):
            self.run_job(fail_migration=True)
        with closing(psycopg2.connect(self.env["TARGET_DATABASE_URL"])) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT id FROM "Tenant"')
                self.assertEqual(cursor.fetchone()[0], "staging")

    def test_failed_promotion_restores_original_name_and_connections(self):
        real_promote = refresh.promote_database

        def fail_second_rename(connection, cursor, target, candidate, previous):
            class FailingCursor:
                def execute(self, statement, params=None):
                    text = statement.as_string(connection) if isinstance(statement, sql.Composable) else statement
                    if text.startswith(f'ALTER DATABASE "{candidate}" RENAME'):
                        raise RuntimeError("injected promotion failure")
                    return cursor.execute(statement, params)

            real_promote(connection, FailingCursor(), target, candidate, previous)

        with patch.object(refresh, "promote_database", fail_second_rename):
            with self.assertRaisesRegex(RuntimeError, "promotion failure"):
                self.run_job()
        with closing(psycopg2.connect(self.env["TARGET_DATABASE_URL"])) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT id FROM "Tenant"')
                self.assertEqual(cursor.fetchone()[0], "staging")
        with closing(psycopg2.connect(self.admin_url)) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT datallowconn FROM pg_database WHERE datname = %s", (self.target,))
                self.assertTrue(cursor.fetchone()[0])

    def test_wrong_server_pin_cannot_restore(self):
        self.env["EXPECTED_STAGING_SYSTEM_IDENTIFIER"] = "not-this-server"
        with self.assertRaisesRegex(RuntimeError, "pinned staging server"):
            self.run_job()

    def test_unowned_rollback_database_is_not_removed(self):
        with closing(psycopg2.connect(self.admin_url)) as connection:
            connection.autocommit = True
            with connection.cursor() as cursor:
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(self.target + "_previous")))
        with self.assertRaisesRegex(RuntimeError, "unowned"):
            self.run_job()
        with closing(psycopg2.connect(self.env["TARGET_DATABASE_URL"])) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT id FROM "Tenant"')
                self.assertEqual(cursor.fetchone()[0], "staging")

    def test_concurrent_refresh_is_rejected(self):
        with closing(psycopg2.connect(self.admin_url)) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_lock(743920261001)")
                with self.assertRaisesRegex(RuntimeError, "already running"):
                    self.run_job()


if __name__ == "__main__":
    unittest.main()
