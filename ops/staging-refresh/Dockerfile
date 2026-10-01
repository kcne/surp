# PostgreSQL clients must match the production backup archive's major version.
FROM postgres:18-alpine

RUN apk add --no-cache aws-cli nodejs npm py3-psycopg2 \
    && npm install --global pnpm@10.6.3

WORKDIR /app/api
COPY api/package.json api/pnpm-lock.yaml ./
RUN PRISMA_SKIP_POSTINSTALL_GENERATE=true pnpm install --frozen-lockfile
COPY api/prisma ./prisma
RUN pnpm prisma:generate

COPY ops/staging-refresh /app/refresh
CMD ["timeout", "14400", "python3", "/app/refresh/refresh.py"]
