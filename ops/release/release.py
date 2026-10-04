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
    """Migration directory names from the paths of files added in a release."""
    names = set()
    for path in paths:
        parts = PurePosixPath(path).relative_to(MIGRATIONS_DIR).parts
        if len(parts) > 1:
            names.add(parts[0])
    return sorted(names)


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

    previous = tags[-1] if tags else None
    # A re-run of an older push must not tag a commit behind the latest release.
    if previous and subprocess.run(["git", "merge-base", "--is-ancestor", head, previous]).returncode == 0:
        log(f"{head} is already part of {previous}; nothing to do")
        return

    tag = next_tag(tags, datetime.now(timezone.utc).date())
    migrations = []
    if previous:
        added = git("diff", "--name-only", "--diff-filter=A", previous, head, "--", MIGRATIONS_DIR)
        migrations = migrations_added(added.split())

    args = ["gh", "release", "create", tag, "--target", head, "--title", tag,
            "--notes", release_notes(previous, migrations)]
    if previous:
        # Appended after the notes above: every pull request merged since the previous tag.
        args += ["--generate-notes", "--notes-start-tag", previous]
    subprocess.run(args, check=True)
    log(f"released {tag} at {head}")


if __name__ == "__main__":
    main()
