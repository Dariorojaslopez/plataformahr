# Release strategy V1.0

Production deploys automatically when CI is fully green on `push` to `main`.

Optional GHCR image publish (`.github/workflows/release.yml`) still requires a `v*.*.*` tag or `workflow_dispatch` with `publish=true`. That workflow does **not** deploy to the VPS.

## Pipeline

```text
push origin main
  → CI (quality, unit, integration, e2e, migrate-gate, build, docker, audit)
  → if all green: deploy job (GitHub Environment production)
  → SSH as non-root deploy user to /opt/plataforma-hr
  → git fetch + checkout --detach ${{ github.sha }}
  → backup PostgreSQL (postgres container → /opt/plataforma-hr/backups/)
  → docker compose build api web (IMAGE_TAG=<sha>)
  → migrate deploy (compose service migrate); abort on failure
  → up API then Web (--no-deps; postgres/volume untouched)
  → healthchecks: API /health, API /ready, Web /
  → on healthcheck failure: application rollback to previous SHA images if present
```

Documented workflows:

- CI + CD: `.github/workflows/ci.yml` (PR gates; `push` to `main` deploys after all jobs)
- Release images: `.github/workflows/release.yml` (`workflow_dispatch` and tags `v*.*.*`)
- VPS scripts: `scripts/deploy-prod.sh`, `scripts/rollback-prod.sh`, `scripts/prod-common.sh`

## Version tags (convention)

| Tag | Meaning | Create now? |
|-----|---------|-------------|
| `v1.0.0-rc.1` | Release candidate logical / first RC | Optional; not required for VPS auto-deploy |
| `v1.0.0` | First production release label | Optional GHCR/semver; `main` already auto-deploys |

### How `release.yml` versions images

On tag push `v*.*.*`:

- `version` = tag name (e.g. `v1.0.0`)
- also tag `: <full git sha>`
- images: `ghcr.io/<owner>/<repo>-api` and `...-web`

On `workflow_dispatch` without tag:

- `version` = `sha-<12>`
- publish only if `publish=true`

VPS production uses compose image names `talento-api:<sha>` / `talento-web:<sha>`, not GHCR, in this version.

## GitHub Environment `production`

- Auto-deploy after green CI (no required reviewers in the workflow).
- Compatible with enabling required reviewers later in the GitHub UI.
- Secrets listed in [ci-cd.md](./ci-cd.md). Do not store `.env.prod` in GitHub.

## Rollback (application)

Use previous known-good **image SHA** (`talento-api:<sha>`, `talento-web:<sha>`):

```bash
# on the VPS, as the deploy user
/opt/plataforma-hr/scripts/rollback-prod.sh <previous-full-sha>
```

Or rely on automatic application rollback inside `deploy-prod.sh` when post-rollout healthchecks fail and previous images exist.

1. Confirm images exist on the host.
2. Recreate **only** API and Web (`--no-deps --no-build`).
3. **Do not** run migrations.
4. Verify `/health`, `/ready`, Web `/`.
5. Confirm DB compatibility (forward-only migrations — see below).

**Do not** run destructive `migrate reset` in production.

## Database rollback policy

Prisma migrations are **forward-only** in normal operations.

- Application rollback ≠ schema rollback.
- Prefer **expand/contract** and backward-compatible migrations.
- Deploy takes a verified logical backup before migrate (`/opt/plataforma-hr/backups/`).
- If a migration fails mid-deploy: **stop**; do not continue API rollout; restore from backup only with a rehearsed procedure and human approval.
- Do not rewrite applied historical migrations except for an explicit BLOCKER with a coordinated fix-forward plan.

## Backup & restore

### Backup during CD

`scripts/deploy-prod.sh` dumps via `docker compose exec postgres pg_dump` (no host port). Destination:

`/opt/plataforma-hr/backups/talento-<UTC>-<sha12>.dump`

Passwords are not printed. Copy dumps off the machine on a schedule.

### Host toolchain (lab / when Postgres is reachable)

```bash
export DATABASE_URL='postgresql://USER:PASS@HOST:PORT/DB?schema=public'
pnpm db:backup
# → backups/talento-<UTC>.dump  (gitignored)
```

This path does **not** work against production compose as-is (Postgres is internal-only).

| Item | Suggestion (starting point — adjust to risk) |
|------|-----------------------------------------------|
| Frequency | Every production deploy (pre-migrate) + daily dump |
| Retention | Staging ≥7 days; production ≥30 days (policy TBD with ops) |
| Security | Store off-host; encrypt at rest if using object storage; restrict ACLs |
| Validation | Periodic restore drill on a **separate** database |

### Restore drill (separate DB)

```bash
# Restore into a disposable DB (see scripts/restore-postgres.sh)
export DATABASE_URL='postgresql://.../talento_restore_drill'
pnpm db:restore backups/talento-<UTC>.dump

curl -fsS "$API/health"   # 200
curl -fsS "$API/ready"    # 200
```

Never restore production dumps onto developer laptops without redaction/approval. Rollback scripts **do not** restore PostgreSQL automatically.

## GO / NO-GO

### Automatic NO-GO (CI will not deploy) if any of:

- Any of the eight CI jobs is red (quality, unit, integration, e2e, migrate-gate, build, docker, audit)
- Event is not `push` to `main` (PRs never deploy)

### Automatic deploy still requires ops readiness

- Secrets configured in Environment `production`
- VPS deploy user, SSH, `/opt/plataforma-hr`, `infrastructure/.env.prod`
- `/ready` reachable from the VPS loopback ports published by compose

### Manual NO-GO / incident

- Migration failure on target (script aborts before API rollout)
- Secret exposed in repo/images/logs
- Tenant isolation broken
- No identifiable rollback image (first SHA-tagged deploy)

## Related checklists

- [checklists/staging-smoke.md](./checklists/staging-smoke.md)
- [checklists/production-preflight.md](./checklists/production-preflight.md)
- [checklists/post-deploy.md](./checklists/post-deploy.md)
- [ci-cd.md](./ci-cd.md)
- [operations-runbook.md](./operations-runbook.md)
