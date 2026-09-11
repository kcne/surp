# Backup runner for the Railway cron service.
#
# PG_MAJOR must match the *production* server's major version. pg_dump refuses
# to dump a server newer than itself, and an archive written by a newer pg_dump
# cannot be restored into an older server — so this one number decides whether
# both the backup and the restore work.
#
# Production runs 18.6. Do not read this version off api/docker-compose.yml or
# the CI workflow: those are the local and CI databases, and they currently sit
# on a different major version (see the note in README.md). Check the server
# itself:
#
#   psql "$DATABASE_URL" -tAc 'show server_version'
#
# When production is upgraded across a major version, this must be bumped in
# the same change. The failure is loud — pg_dump aborts — but every backup is
# missing until it is fixed.
ARG PG_MAJOR=18

FROM postgres:${PG_MAJOR}-alpine

RUN apk add --no-cache aws-cli bash

COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

# Railway runs this on the cron schedule and the container exits when it
# finishes; a non-zero exit marks the run as failed.
CMD ["/usr/local/bin/backup.sh"]
