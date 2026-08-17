# Production infrastructure (Fase 11)

Portable foundation for containerized deployment. **Not** a cloud provider rollout.

## Architecture / topology

```text
Internet
   ↓ HTTPS (TLS at reverse proxy / load balancer)
Next.js Web  (container, non-root)
   ↓ HTTPS or same-origin proxy
NestJS API   (container, non-root, TRUST_PROXY=1 when behind proxy)
   ↓ private network
PostgreSQL 17 (volume-backed, not published publicly)
```

### Trust boundaries

| Zone | Components | Exposure |
|------|------------|----------|
| Public edge | Reverse proxy / LB | Internet HTTPS only |
| App edge | Web + API published ports (lab) or private behind proxy | Restricted |
| Internal | PostgreSQL, migrate job, API→DB | No public ports |

### Recommended cookie topology

**Current code (Fase 10)** is cross-origin friendly:

- `web.example.com` + `api.example.com`
- Refresh cookie: `HttpOnly` + `Secure` + `SameSite=None` + `Path=/auth` (`COOKIE_PATH`)
- CORS allowlist + Origin checks on auth mutations

**Preferred long-term simplification (not implemented here):** same-origin reverse proxy

```text
https://app.example.com/     → Next.js
https://app.example.com/api/ → NestJS
```

When the browser calls `https://app.example.com/api/auth/*`, set `COOKIE_PATH=/api/auth` so `tsc_refresh` is sent on refresh. Nest still serves `/auth` after the proxy strips `/api`.

Benefits: `SameSite=Lax`, simpler CSRF/CORS. Requires aligning `NEXT_PUBLIC_API_URL` and `COOKIE_PATH`.

## Containers

| Image | Dockerfile | Runtime user | Start |
|-------|------------|--------------|-------|
| `talento-api` | `apps/api/Dockerfile` | `nestjs` (uid 1001) | `node dist/main.js` |
| `talento-web` | `apps/web/Dockerfile` | `nextjs` (uid 1001) | `node apps/web/server.js` |

- Node **22.16.0** (see `.nvmrc`; engines `>=20 <25`), pnpm **11.20.0** (npm global install in Docker images).
- Multi-stage builds; `--frozen-lockfile`; no `.env` copied into images.
- Tagging: use `{version}` + git SHA in real registries; avoid relying on `latest` alone.

## Environment model

| Env | Purpose |
|-----|---------|
| Development | Local `pnpm` + `infrastructure/docker-compose.yml` (Postgres on 5433) |
| Test | Jest/Vitest against local/test DB |
| Staging | Production-like compose or future platform; real secrets; no DEV seeds |
| Production | Same images; strong secrets; HTTPS; migrate-once; no DEV/QA seeds |

### API variables (critical)

`NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `CORS_ORIGINS`, optional `COOKIE_*`, `TRUST_PROXY`, `JSON_BODY_LIMIT`.

Fail-fast validation from Fase 10 (`validateSecurityEnv`).

### Web / `NEXT_PUBLIC_*`

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_STT_LANGUAGE` are **baked at image build time**. Rebuild the web image when the public API URL changes. Do not assume `localhost` in real deployments.

## Health & readiness

| Endpoint | Meaning | DB |
|----------|---------|----|
| `GET /health` | Process alive | No |
| `GET /ready` | Can serve traffic | Yes (`SELECT 1`) → **200** / **503** |

No secrets or connection strings in responses.

### Incident: DB down

- `/health` may stay **200**
- `/ready` → **503**
- Business endpoints fail with sanitized errors
- When DB returns, `/ready` → **200** without restart (new requests)

## Graceful shutdown

- `app.enableShutdownHooks()`
- `PrismaService.onModuleDestroy` → `$disconnect`
- Compose `stop_grace_period` set; PID 1 is `node`

## Prisma lifecycle

- Single `PrismaService` (global module): `$connect` on init, `$disconnect` on destroy.
- `prisma generate` during **image build**.
- Production migrations: **`pnpm db:migrate:deploy`** / compose `migrate` service — **never** `migrate dev` in prod.
- Pattern: migrate **once** → start/update API replicas. API startup does **not** mutate schema.

## Seed / bootstrap policy

| Seed | Production |
|------|------------|
| `db:seed` (RBAC catalog) | Explicit, controlled, one-time/ops |
| `db:seed:dev` / `db:seed:qa` | **Forbidden** (`NODE_ENV=production` throws) |

### First Platform Owner

No default credentials. Operational options:

1. Controlled one-off SQL/Prisma script with secrets from a vault (operator-run).
2. Future admin bootstrap CLI (not in this phase).

Never bake owner passwords into images or compose files.

## Backups

- Logical backups: `scripts/backup-postgres.sh` (`pg_dump --format=custom`).
- Restore: `scripts/restore-postgres.sh --yes <file.dump>` (requires `--yes`).
- Store dumps **off-host**, encrypt at rest via platform, verify restores periodically.
- Gitignore: `backups/`, `*.dump`.

### RPO / RTO (initial operational targets — not contractual SLA)

| Metric | Initial target |
|--------|----------------|
| RPO | ≤ 24h (daily logical backup); tighten with WAL/PITR later |
| RTO | ≤ 4h for restore-to-staging + cutover drill on lab hardware |

## TLS & reverse proxy

- Public traffic **HTTPS only**; TLS terminates at proxy/LB.
- Reference: `infrastructure/nginx.example.conf`.
- Set `TRUST_PROXY=1` so Nest trusts a **single** hop for `X-Forwarded-*` / `req.ip` / secure cookies.
- Do not expose Nest/Next directly to the internet without a proxy in real prod.

## Volumes & networks

- Volume `talento_prod_pgdata` persists PostgreSQL data across container recreate.
- Network `internal` (internal=true): DB + migrate + API.
- Network `edge`: published Web/API ports for lab access.

## Resource notes (lab estimates only)

| Service | Rough RAM | Notes |
|---------|-----------|-------|
| postgres | 512MB–2GB | Depends on data |
| api | 256–512MB | Nest + Prisma |
| web | 256–512MB | Next standalone |

Set real cgroup limits after measurement. Read-only root FS: possible for API with care; Next may need tmp — not forced here. No server-side uploads / audio persistence.

## Logging / timezone

- Logs to **stdout/stderr** (container-native). Centralization = Fase 12+.
- Containers `TZ=UTC`. Store timestamps UTC; FE presents via existing helpers.

## Local production-like stack

```bash
cp infrastructure/.env.prod.example infrastructure/.env.prod
# edit secrets + CORS + NEXT_PUBLIC_API_URL
pnpm infra:prod:up          # or step-by-step migrate then up
# preferred explicit migrate:
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod up -d postgres
pnpm infra:prod:migrate
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod up -d --build api web
```

DEV Postgres compose (`infrastructure/docker-compose.yml`) remains unchanged for local development.

## Migration rules (forward)

- Migrations are append-only; do not edit applied SQL.
- Prefer expand/contract for breaking changes.
- Backup before critical migrations.
- App rollback ≠ DB rollback; redeploy older images only if schema remains compatible.

## Production checklist

- [ ] Strong distinct JWT secrets; rotated if ever leaked
- [ ] `CORS_ORIGINS` exact browser origins
- [ ] HTTPS + reverse proxy; `TRUST_PROXY=1`
- [ ] Postgres not publicly reachable
- [ ] `migrate deploy` succeeded on empty DB once
- [ ] RBAC seed applied deliberately (no DEV users)
- [ ] Platform owner created via secure ops process
- [ ] Backup + restore drill completed
- [ ] Images tagged (version/SHA), non-root, no secrets baked in
- [ ] `/health` and `/ready` wired into orchestrator probes

## Known debt

- No CI/CD, registry, K8s, Terraform, Redis, or full observability (later phases).
- Same-origin `/api` proxy not wired in application code.
- Access JWT still valid until TTL after logout (Fase 10 debt).
- In-memory rate limiting (single instance).
