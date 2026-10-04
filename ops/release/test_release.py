import os
import subprocess
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import release


class NextTag(unittest.TestCase):
    def test_first_release_of_the_month_is_one(self):
        self.assertEqual(release.next_tag([], date(2026, 10, 4)), "v2026.10.1")

    def test_counts_up_within_the_month(self):
        tags = ["v2026.10.1", "v2026.10.2"]
        self.assertEqual(release.next_tag(tags, date(2026, 10, 31)), "v2026.10.3")

    def test_restarts_in_a_new_month(self):
        tags = ["v2026.10.1", "v2026.10.2"]
        self.assertEqual(release.next_tag(tags, date(2026, 11, 1)), "v2026.11.1")

    def test_compares_numbers_not_strings(self):
        tags = [f"v2026.10.{n}" for n in range(1, 11)]
        self.assertEqual(release.next_tag(tags, date(2026, 10, 4)), "v2026.10.11")

    def test_ignores_tags_that_are_not_releases(self):
        tags = ["v2026.10.7-rc", "v2026.010.1", "release-5", "v1.2"]
        self.assertEqual(release.next_tag(tags, date(2026, 10, 4)), "v2026.10.1")


class ReleaseTags(unittest.TestCase):
    def test_orders_by_version(self):
        tags = ["v2026.10.10", "v2027.1.1", "v2026.9.3", "v2026.10.2", "other"]
        self.assertEqual(release.release_tags(tags),
                         ["v2026.9.3", "v2026.10.2", "v2026.10.10", "v2027.1.1"])


class MigrationsAdded(unittest.TestCase):
    def test_lists_each_migration_directory_once(self):
        paths = [
            "api/prisma/migrations/20261001120000_b/migration.sql",
            "api/prisma/migrations/20260930120000_a/migration.sql",
            "api/prisma/migrations/20260930120000_a/down.sql",
            "api/prisma/migrations/migration_lock.toml",
        ]
        self.assertEqual(release.migrations_added(paths),
                         ["20260930120000_a", "20261001120000_b"])


class ReleaseNotes(unittest.TestCase):
    def test_names_the_migrations(self):
        notes = release.release_notes("v2026.10.1", ["20261001120000_b"])
        self.assertEqual(notes, "## Migrations\n\n- `20261001120000_b`")

    def test_says_when_there_are_none(self):
        self.assertEqual(release.release_notes("v2026.10.1", []), "## Migrations\n\nNone.")

    def test_first_release_has_nothing_to_compare(self):
        self.assertIn("First tagged release", release.release_notes(None, []))


class Main(unittest.TestCase):
    """Runs against a throwaway git repository; only `gh` is replaced."""

    def setUp(self):
        self.repo = tempfile.TemporaryDirectory()
        self.addCleanup(self.repo.cleanup)
        cwd = os.getcwd()
        os.chdir(self.repo.name)
        self.addCleanup(os.chdir, cwd)
        self.run_git("init", "-q", "-b", "master")
        self.commit("README.md")

    def run_git(self, *args):
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
               "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
        return subprocess.run(["git", *args], check=True, capture_output=True, text=True,
                              env=env).stdout.strip()

    def commit(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(path)
        self.run_git("add", path)
        self.run_git("commit", "-q", "-m", path)
        return self.run_git("rev-parse", "HEAD")

    def release(self, head):
        real_run = subprocess.run
        gh_calls = []

        def run(args, *rest, **kwargs):
            if args[0] == "gh":
                gh_calls.append(args)
                return subprocess.CompletedProcess(args, 0)
            return real_run(args, *rest, **kwargs)

        with patch.dict(os.environ, {"GITHUB_SHA": head}), \
                patch.object(release.subprocess, "run", side_effect=run):
            release.main()
        return gh_calls

    def test_first_release_skips_generated_notes(self):
        head = self.run_git("rev-parse", "HEAD")

        [call] = self.release(head)

        self.assertEqual(call[:7], ["gh", "release", "create", call[3], "--target", head, "--title"])
        self.assertRegex(call[3], r"^v\d{4}\.\d{1,2}\.1$")
        self.assertNotIn("--generate-notes", call)

    def test_lists_migrations_added_since_the_previous_release(self):
        self.run_git("tag", "v2000.1.1")
        head = self.commit("api/prisma/migrations/20261001120000_b/migration.sql")

        [call] = self.release(head)

        notes = call[call.index("--notes") + 1]
        self.assertIn("- `20261001120000_b`", notes)
        self.assertEqual(call[-3:], ["--generate-notes", "--notes-start-tag", "v2000.1.1"])

    def test_does_nothing_when_the_commit_is_already_released(self):
        head = self.commit("a.txt")
        self.run_git("tag", "v2000.1.1")

        self.assertEqual(self.release(head), [])

    def test_does_nothing_for_a_commit_behind_the_latest_release(self):
        older = self.commit("a.txt")
        self.commit("b.txt")
        self.run_git("tag", "v2000.1.1")

        self.assertEqual(self.release(older), [])


if __name__ == "__main__":
    unittest.main()
