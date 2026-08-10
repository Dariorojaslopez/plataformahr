# Staging readiness

Portable staging configuration for **Talento sin clave** V1. No cloud vendor lock-in.
Companion docs: [environment-matrix.md](./environment-matrix.md) · [release.md](./release.md) · [production-infrastructure.md](./production-infrastructure.md) · [operations-runbook.md](./operations-runbook.md).

## Purpose

Staging mirrors production topology as closely as possible:

- same Docker images (immutable SHA tags);
- same migration path (`prisma migrate deploy`);
- same cookie/CORS/proxy settings shape;
- non-production data and secrets only.

Staging is **not** a second development machine: no `prisma migrate dev`, no `db:seed:dev` / `db:seed:qa` unless explicitly approved for a disposable staging DB.

## Topology (reference)

```text
[Browser]
   │ HTTPS
   ▼
[Reverse proxy / TLS termination]  ← nginx.example.conf as reference
   ├─ /            → web:3000
   ├─ /api/*       → api:3001  (recommended same-origin long-term)
   └─ /metrics     → deny (or private network only)
         │
         ▼
   [API container] ── DATABASE_URL ──► [PostgreSQL 17]
```

Local lab equivalent: `infrastructure/docker-compose.prod.yml` + `infrastructure/.env.staging.example` (copy to untracked `.env.staging`).

## Components

| Component | Staging expectation |
|-----------|---------------------|
| **API** | Image `*-api:<git-sha>` or `:v1.0.0-rc.N`. `NODE_ENV=production`. Fail-fast env validation. |
| **Web** | Image `*-web:<git-sha>` with `NEXT_PUBLIC_API_URL` baked at build for the staging API origin. |
| **PostgreSQL** | Dedicated staging instance/DB. Not shared with production. Backups enabled. |
| **Migrations** | `pnpm db:migrate:deploy` / compose `migrate` service **once** before rolling new API. |
| **Bootstrap seed** | `pnpm db:seed` (RBAC catalog only). **Never** `db:seed:dev` / `db:seed:qa` on shared staging with real users unless DB is disposable. |
| **Secrets** | Staging-only JWT secrets, DB password, distinct from local and production. Never commit. |
| **Health** | `GET /health` → process alive (200). |
| **Readiness** | `GET /ready` → DB reachable (200) or 503. |
| **Logging** | `LOG_FORMAT=json`, stdout. Correlate via `X-Request-Id`. |
| **Metrics** | `METRICS_ENABLED=true`, scrape from private network; proxy **deny** public `/metrics`. |
| **Reverse proxy** | TLS at edge; `TRUST_PROXY=1` on API when a single trusted hop exists. |
| **HTTPS/TLS** | Required for real staging hosts. Local lab may use HTTP + `COOKIE_SECURE` caveats. |
| **CORS** | Exact staging web origin(s) in `CORS_ORIGINS`. No `*`. |
| **Cookies** | Refresh `tsc_refresh` HttpOnly; Path=`/auth`; SameSite per topology (`none`+Secure if cross-origin). |
| **Trusted proxy** | Set only behind a real reverse proxy. |
| **Rate limiting** | `THROTTLE_*` enabled (defaults apply). |
| **Backups** | Daily (or better) logical dumps; retain ≥7 days staging. See [backup section in release.md](./release.md#backup--restore). |
| **Restore** | Drill on a **separate** DB before relying on backups. |
| **Rollback** | Redeploy previous image SHA; DB migrations are forward-only (see release policy). |

## Environment file

```bash
cp infrastructure/.env.staging.example infrastructure/.env.staging
# edit secrets — never commit .env.staging
```

## Bring-up (lab / staging-like)

```bash
docker compose -f infrastructure/docker-compose.prod.yml \
  --env-file infrastructure/.env.staging up -d postgres

docker compose -f infrastructure/docker-compose.prod.yml \
  --env-file infrastructure/.env.staging run --rm migrate

# Optional RBAC catalog bootstrap (idempotent upserts)
DATABASE_URL='postgresql://...' pnpm db:seed

docker compose -f infrastructure/docker-compose.prod.yml \
  --env-file infrastructure/.env.staging up -d --build api web
```

Smoke: [checklists/staging-smoke.md](./checklists/staging-smoke.md).

## What staging must NOT do

- Deploy production secrets or production DB URLs.
- Run `prisma db push` or `migrate dev` against staging.
- Expose `/metrics` publicly.
- Auto-publish GHCR or create Git tags from this documentation alone.
- Treat local `apps/api/.env` as staging config.
