FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.6.3 --activate

WORKDIR /app

COPY api/package.json api/pnpm-lock.yaml ./api/

WORKDIR /app/api
RUN pnpm install --frozen-lockfile

COPY api/ .

RUN pnpm prisma:generate
RUN pnpm build

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma:migrate:deploy && pnpm seed:prod:once && pnpm start:prod"]
