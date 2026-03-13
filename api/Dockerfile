FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
RUN corepack enable && corepack prepare pnpm@10.6.3 --activate
RUN pnpm install --frozen-lockfile=false

COPY . .
RUN pnpm build

EXPOSE 3001
CMD ["pnpm", "start:prod"]
