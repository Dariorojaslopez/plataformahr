# Environment matrix

Authoritative matrix for **local**, **test**, **staging**, and **production**.
If code and this doc disagree, fix the mismatch — do not invent silent defaults in production.

| Concern | Local | Test (CI / e2e) | Staging | Production |
|---------|-------|-----------------|---------|------------|
| **NODE_ENV** | `development` | `test` (e2e may set production-like cookie flags explicitly) | `production` | `production` |
| **Database** | Compose DEV Postgres 17 (`localhost:5433`) | Ephemeral Postgres 17 service / local test DB | Dedicated staging Postgres 17 | Dedicated production Postgres 17 (private network) |
| **DATABASE_URL** | Required (`.env.example`) | Injected by CI / e2e harness | Required (staging secrets) | Required (prod secrets) |
| **Logging** | Pretty or JSON (`LOG_FORMAT` optional) | Test runner output | JSON stdout (`LOG_FORMAT=json`) | JSON stdout only |
| **LOG_LEVEL** | `debug`/`info` OK | default/`warn` OK | `info` (or `warn`) | `info` or `warn` — never `debug` with bodies |
| **Metrics** | Optional (`METRICS_ENABLED`) | Usually on in app under test | On; **private scrape only** | On; **private scrape only** |
| **HTTPS** | Optional (localhost) | N/A (supertest HTTP) | Required on real hosts | Required |
| **CORS** | Default `http://localhost:3000` if unset | Test origins / harness | Exact staging origins; no `*` | Exact prod origins; no `*`; fail-fast if missing |
| **Cookies** | Often `SameSite=None`+Secure for cross-origin local; e2e may force `lax` | Forced for HTTP e2e as needed | Match topology; Secure on HTTPS | Secure; SameSite per topology |
| **Secrets** | Dev placeholders OK (≥32 chars recommended) | CI-generated / fixtures | Strong staging-only | Strong prod-only; rotated; never shared |
| **JWT secrets** | Weak defaults warn only | Test secrets | Fail if weak | Fail if weak / identical |
| **Migrations** | `pnpm db:migrate` (dev) | migrate deploy / test setup | **`migrate deploy` only** | **`migrate deploy` only** |
| **`prisma db push`** | Forbidden as release path | Forbidden | Forbidden | Forbidden |
| **Seed RBAC** (`db:seed`) | Yes | As needed | Yes (catalog bootstrap) | Yes (catalog bootstrap only) |
| **Seed demo** (`db:seed:dev` / `qa`) | Allowed | Allowed in disposable DBs | Only on disposable staging | **Forbidden** (`NODE_ENV=production` throws) |
| **Debug / stack traces** | Allowed in responses carefully | Test assertions | Sanitized client errors | Sanitized; no stacks to clients |
| **Observability** | Local stdout | CI logs | JSON + requestId + private `/metrics` | Same + alerting/SLO (see observability.md) |
| **Rate limiting** | On | On | On | On |
| **TRUST_PROXY** | Usually unset | Unset | `1` behind one proxy | `1` behind one proxy |
| **Build** | `pnpm dev:*` | CI build jobs | Immutable images by SHA | Immutable images by SHA / version tag |

## Explicit production prohibitions

In **production** (and real staging treated as production-hardened):

1. Do **not** run `db:seed:dev` or `db:seed:qa`.
2. Do **not** use `prisma migrate dev` or `prisma db push`.
3. Do **not** ship DEV JWT secrets or passwords from `.env.example`.
4. Do **not** set `CORS_ORIGINS=*`.
5. Do **not** expose `/metrics` on the public internet.
6. Do **not** commit `.env`, `.env.prod`, `.env.staging`, dumps, or certificates.
7. Do **not** enable client-visible stack traces.
8. Do **not** point staging tooling at the production database.

## Variable inventory (API)

| Variable | Required prod/staging | Notes |
|----------|----------------------|-------|
| `DATABASE_URL` | Yes | Fail-fast if missing |
| `JWT_ACCESS_SECRET` | Yes | ≥32 chars; not weak defaults |
| `JWT_REFRESH_SECRET` | Yes | Distinct from access |
| `JWT_ACCESS_TTL` | No | Default `15m` |
| `JWT_REFRESH_TTL` | No | Default `7d` |
| `CORS_ORIGINS` | Yes in production | Comma-separated exact origins |
| `COOKIE_SAMESITE` | Recommended | `none`\|`lax`\|`strict` |
| `COOKIE_SECURE` | Recommended | Forced when SameSite=none or production |
| `COOKIE_PATH` | Recommended behind `/api` | App default `/auth`; prod compose default `/api/auth` |
| `TRUST_PROXY` | If behind proxy | e.g. `1` |
| `PORT` | No | Default `3001` |
| `NODE_ENV` | Yes | `production` for staging/prod runtime |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | No | Defaults apply |
| `JSON_BODY_LIMIT` | No | Default `1mb` |
| `COMPANY_UPLOADS_DIR` | Yes in production | Absolute directory for tenant logos. Compose sets `/data/company-uploads` on volume `talento_prod_company_uploads`. |
| `LOG_LEVEL` / `LOG_FORMAT` | Recommended | JSON in prod |
| `SLOW_REQUEST_MS` | No | Default `1000` |
| `METRICS_ENABLED` | No | Default `true` |
| `DEV_*` | **Never in prod** | Only for `db:seed:dev` |

## Variable inventory (Web)

| Variable | When | Notes |
|----------|------|-------|
| `NEXT_PUBLIC_API_URL` | Build time | Baked into client bundle |
| `NEXT_PUBLIC_STT_LANGUAGE` | Optional | Browser STT locale hint |

Sources of truth: `.env.example`, `infrastructure/.env.prod.example`, `infrastructure/.env.staging.example`, `apps/web/.env.example`, `validateSecurityEnv()`.
