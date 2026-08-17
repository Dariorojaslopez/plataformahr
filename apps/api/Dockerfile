# syntax=docker/dockerfile:1.7
# Production image for NestJS API (pnpm monorepo).
# Build from repository root:
#   docker build -f apps/api/Dockerfile -t talento-api:local .

ARG NODE_VERSION=22.16.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Install pnpm via npm (avoids Corepack+pnpm 11 dynamic-import issues on some Node builds).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@11.20.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --filter @talento/shared... --filter api...

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @talento/shared build \
  && pnpm --filter api exec prisma generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy --prod --legacy /out/api

# Ensure Prisma schema/migrations, compiled app, and generated client for the deployed tree.
# Replace broken workspace symlink for @talento/shared with a real package copy.
RUN mkdir -p /out/api/prisma /out/api/dist \
  && cp -R apps/api/prisma /out/api/ \
  && cp -R apps/api/dist /out/api/ \
  && rm -rf /out/api/node_modules/@talento/shared \
  && mkdir -p /out/api/node_modules/@talento/shared \
  && cp packages/shared/package.json /out/api/node_modules/@talento/shared/ \
  && cp -R packages/shared/dist /out/api/node_modules/@talento/shared/ \
  && cd /out/api \
  && npx prisma generate --schema=prisma/schema.prisma \
  && rm -rf src test Dockerfile README.md eslint.config.mjs nest-cli.json \
       tsconfig.json tsconfig.build.json .prettierrc .env .env.* 2>/dev/null || true

FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nestjs

COPY --from=build --chown=nestjs:nodejs /out/api /app

RUN mkdir -p /data/company-uploads \
  && chown nestjs:nodejs /data/company-uploads

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/ready >/dev/null || exit 1

# PID 1 = node so SIGTERM reaches Nest shutdown hooks.
CMD ["node", "dist/main.js"]
