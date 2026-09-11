# Backup runner for the Railway cron service.
#
# Based on the Postgres image so pg_dump matches the server's major version.
# A major-version mismatch is the classic way a backup runs happily for months
# and then refuses to restore.
FROM postgres:16-alpine

RUN apk add --no-cache aws-cli bash

COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

# Railway runs this on the cron schedule and the container exits when it
# finishes; a non-zero exit marks the run as failed.
CMD ["/usr/local/bin/backup.sh"]
