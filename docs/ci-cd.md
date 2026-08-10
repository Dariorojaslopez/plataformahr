# CI/CD (Fase 12)

## Provider

GitHub Actions (repository: GitHub).

Workflows:

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | PR + `main` quality gates |
| `.github/workflows/release.yml` | Tag / manual image build (+ optional GHCR publish) |
| `.github/dependabot.yml` | Weekly npm + Actions updates |

## CI principles

- `pnpm install --frozen-lockfile`
- Node **22.16.0** / pnpm **11.20.0** (aligned with `.nvmrc` / Docker)
- Minimal permissions (`contents: read` on CI)
- Concurrency cancels superseded PR runs
- No production deploy from CI

## Jobs

1. **Quality** — Prisma validate + format gate (`git diff` after format) + generate + lint  
2. **Unit** — `pnpm test`  
3. **E2E** — PostgreSQL 17 service → `migrate deploy` → `db:seed` (RBAC only) → `pnpm test:e2e` (`maxWorkers: 1`)  
4. **Migration gate** — empty DB → `migrate deploy` → count `_prisma_migrations`  
5. **Build** — `build:api` + `build:web`  
6. **Docker** — build API/Web images tagged with `${{ github.sha }}` (no push)  
7. **Audit** — `pnpm audit --audit-level=high`

## Docker tagging

| Context | Tag |
|---------|-----|
| CI build | `talento-api:<sha>`, `talento-web:<sha>` |
| Release | `ghcr.io/<owner>/<repo>-api:<sha>` and `:<semver-or-sha-version>` |
| Avoid | relying only on `latest` |

## Registry

Reference: **GHCR** (`ghcr.io`). Owner/repo derived dynamically — no invented org names.

## CD strategy (no auto-deploy)

See [release.md](./release.md) and [staging.md](./staging.md). Separate concerns:

1. CI green  
2. Build immutable images  
3. Publish (release workflow / tag) — human gated  
4. Backup (ops)  
5. **Migrate once**  
6. Readiness check  
7. Rollout API → Web  
8. Smoke  

### Environments

- **staging** — authorized deploy of SHA; see staging readiness docs  

- **production** — **manual approval** required; never auto-deploy on push to `main`

### Rollback

Redeploy previous image tags. Database rollback is **not** automatic (see Fase 11).

### Secrets

Use GitHub Actions Secrets / Environment secrets. Never `echo` secrets or dump `printenv`.

## Migration immutability

Applied Prisma migrations are append-only. Do not edit historical SQL. Prefer expand/contract for breaking changes.

## Release trigger

- Semver tag `v*.*.*` or `workflow_dispatch`  
- Optional `publish=true` for GHCR push  
- Versioning rules: [release.md](./release.md)

## Actions security note (V1)

Workflows reference Actions by mutable tags (`actions/checkout@v4`, `docker/build-push-action@v6`, etc.). Acceptable for V1 with Dependabot; **pin to full commit SHAs** before high-assurance production if policy requires.
