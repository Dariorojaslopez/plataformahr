# CI/CD (Fase 12)

## Provider

GitHub Actions (repository: GitHub).

Workflows:

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | PR quality gates; on `push` to `main`, all CI jobs then automatic production deploy |
| `.github/workflows/release.yml` | Tag / manual image build (+ optional GHCR publish). Does **not** deploy to the VPS |
| `.github/dependabot.yml` | Weekly npm + Actions updates |

## CI principles

- `pnpm install --frozen-lockfile`
- Node **22.16.0** / pnpm **11.20.0** (aligned with `.nvmrc` / Docker)
- Minimal permissions (`contents: read`)
- Pull requests: concurrency cancels superseded runs
- `push` to `main`: concurrency does **not** cancel in-progress runs (a deploy must finish)
- Production deploy runs **only** after **all** CI jobs succeed on a `push` to `main`

## Jobs

1. **Quality** — Prisma validate + format gate (`git diff` after format) + generate + lint
2. **Unit** — `pnpm test` (no PostgreSQL; excludes `*.persistence.spec.ts`)
3. **Persistence** — PostgreSQL 17 service → `migrate deploy` → `db:seed` (RBAC only) → `pnpm test:integration`
4. **E2E** — PostgreSQL 17 service → `migrate deploy` → `db:seed` (RBAC only) → `pnpm test:e2e` (`maxWorkers: 1`)
5. **Migration gate** — empty DB → `migrate deploy` → count `_prisma_migrations`
6. **Build** — `build:api` + `build:web`
7. **Docker** — build API/Web images tagged with `${{ github.sha }}` (no push; CI validation only)
8. **Audit** — `pnpm audit --audit-level=high`
9. **Deploy production** — `needs` the eight jobs above; `if: push && main`; GitHub Environment `production`

A failed or skipped CI job **cannot** start deploy (`needs: [quality, unit, integration, e2e, migrate-gate, build, docker, audit]`). Pull requests never deploy.

`apps/api/src/core/multitenant.persistence.spec.ts` is an **integration** suite (real Prisma + PostgreSQL, no HTTP). It is not unit and not e2e.

## Production CD

```text
push origin main
  → CI jobs 1–8 (all must succeed)
  → job deploy (environment: production)
  → SSH to VPS as deploy user
  → scripts/deploy-prod.sh ${{ github.sha }}
```

VPS project directory: `/opt/plataforma-hr`.

Exact revision: GitHub sends `${{ github.sha }}`. The script `git fetch`es and `git checkout --detach` that SHA (never `git pull`).

### Environment

GitHub Environment name: **`production`**.

- Required reviewers are **not** enabled in the workflow (auto-deploy after green CI).
- Reviewers / wait timer can be turned on later in the GitHub UI without changing job structure.

### Secrets (Environment `production`)

Configure these in GitHub (never commit values; never copy `.env.prod` into GitHub):

| Secret | Purpose |
|--------|---------|
| `SSH_HOST` | VPS hostname or IP |
| `SSH_PORT` | SSH port (optional; script defaults to `22` if empty) |
| `SSH_USER` | Non-root deploy user |
| `SSH_PRIVATE_KEY` | Private key matching the VPS `authorized_keys` |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan` output for `StrictHostKeyChecking=yes` |

Application runtime secrets stay **only** on the VPS:

`/opt/plataforma-hr/infrastructure/.env.prod`

### Concurrency

- Workflow: PRs cancel in progress; `main` does not.
- Deploy job: group `deploy-production`, `cancel-in-progress: false`.

Two production deploys never run at the same time; a started deploy is not cancelled by a later push.

### Images (this version)

Build **on the VPS** with `IMAGE_TAG=<full-git-sha>`. No GHCR pull in the deploy path.

CI Docker job images (`talento-api:<sha>` on the runner, Web built with `localhost`) are **not** shipped to production.

Optional GHCR publish remains in `.github/workflows/release.yml` (tags / `workflow_dispatch`) and is unrelated to VPS auto-deploy.

### Rollback

`scripts/rollback-prod.sh <sha>` on the VPS. Redeploys existing `talento-api:<sha>` and `talento-web:<sha>`. Does **not** run migrations or restore PostgreSQL.

If post-rollout healthchecks fail, `deploy-prod.sh` attempts that application rollback automatically when previous images exist.

### Backup

Before migrate, `deploy-prod.sh` runs `pg_dump` **inside** the `postgres` container (Postgres has no host port). File:

`/opt/plataforma-hr/backups/talento-<UTC>-<sha12>.dump`

### Forbidden on production

- `docker compose down` / `docker compose down -v` (destroys or risks `talento_prod_pgdata`)
- `prisma migrate dev`, `prisma db push`, `migrate reset`
- Deploy as `root`
- `git pull` as the deploy mechanism

## Docker tagging

| Context | Tag |
|---------|-----|
| CI build (runner only) | `talento-api:<sha>`, `talento-web:<sha>` |
| VPS production | `talento-api:<sha>`, `talento-web:<sha>` via `IMAGE_TAG` |
| Release workflow | `ghcr.io/<owner>/<repo>-api:<sha>` and `:<semver-or-sha-version>` |
| Avoid | relying only on `latest` or `local` in production |

## Registry

Reference: **GHCR** (`ghcr.io`) for optional image publish. Production CD in this version does **not** pull from GHCR.

## Migration immutability

Applied Prisma migrations are append-only. Do not edit historical SQL. Prefer expand/contract for breaking changes. Application rollback ≠ schema rollback.

## Release trigger (images only)

- Semver tag `v*.*.*` or `workflow_dispatch`
- Optional `publish=true` for GHCR push
- Versioning rules: [release.md](./release.md)

## Actions security note (V1)

Workflows reference Actions by mutable tags (`actions/checkout@v4`, `docker/build-push-action@v6`, etc.). Acceptable for V1 with Dependabot; **pin to full commit SHAs** before high-assurance production if policy requires.
