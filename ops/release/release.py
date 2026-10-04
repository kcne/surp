"""Tag a production release each time rolling is promoted into master."""

import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import PurePosixPath


# vYEAR.MONTH.N, N counting releases within the month. No zero padding, so the
# name stays SemVer-shaped for tools that sort tags.
TAG_PATTERN = re.compile(r"^v(\d{4})\.([1-9]\d?)\.([1-9]\d*)$")
MIGRATIONS_DIR = "api/prisma/migrations"


def log(message):
    print(f"[release] {message}", flush=True)


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def release_tags(tags):
    """Release tags ordered oldest to newest; anything else is ignored."""
    parsed = [(tuple(int(part) for part in match.groups()), tag)
              for tag in tags if (match := TAG_PATTERN.match(tag))]
    return [tag for _, tag in sorted(parsed)]


def next_tag(tags, today):
    used = [int(match[3]) for tag in tags
            if (match := TAG_PATTERN.match(tag))
            and (int(match[1]), int(match[2])) == (today.year, today.month)]
    return f"v{today.year}.{today.month}.{max(used, default=0) + 1}"


def migrations_added(paths):
    """Migration directory names from the paths of files added in a release.

    Only a new migration.sql counts, so a file added to an existing migration
    directory does not list that migration again.
    """
    return sorted(parts[0] for path in paths
                  if len(parts := PurePosixPath(path).relative_to(MIGRATIONS_DIR).parts) == 2
                  and parts[1] == "migration.sql")


def release_notes(previous, migrations):
    if previous is None:
        return "First tagged release. Earlier changes are in the commit history."
    lines = ["## Migrations", ""]
    lines += [f"- `{name}`" for name in migrations] or ["None."]
    return "\n".join(lines)


def main():
    head = os.environ["GITHUB_SHA"]
    tags = release_tags(git("tag", "--list", "v*").split())

    if release_tags(git("tag", "--points-at", head).split()):
        log(f"{head} is already released; nothing to do")
        return

    # A re-run of an older push must not tag a commit behind the latest release.
    if tags and subprocess.run(["git", "merge-base", "--is-ancestor", head, tags[-1]]).returncode == 0:
        log(f"{head} is already part of {tags[-1]}; nothing to do")
        return

    # The notes start from the latest release head contains, so a release tag
    # on a commit that never reached master cannot hide its migrations.
    reachable = release_tags(git("tag", "--list", "v*", "--merged", head).split())
    previous = reachable[-1] if reachable else None

    tag = next_tag(tags, datetime.now(timezone.utc).date())
    migrations = []
    if previous:
        # Prisma tracks migrations by directory name, so a renamed one runs
        # again; --no-renames reports it as added instead of hiding it.
        added = git("diff", "--name-only", "--no-renames", "--diff-filter=A",
                    previous, head, "--", MIGRATIONS_DIR)
        migrations = migrations_added(added.splitlines())

    args = ["gh", "release", "create", tag, "--target", head, "--title", tag,
            "--notes", release_notes(previous, migrations)]
    if previous:
        # Appended after the notes above: every pull request merged since the previous tag.
        args += ["--generate-notes", "--notes-start-tag", previous]
    subprocess.run(args, check=True)
    log(f"released {tag} at {head}")


if __name__ == "__main__":
    main()
