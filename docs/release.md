# Release strategy V1.0

No automatic production deploy. Tags and GHCR publish require human authorization.

## Pipeline

```text
main (green CI)
  → immutable image SHA (CI/local Docker build)
  → staging deploy (authorized)
  → staging QA / smoke checklist
  → human approval
  → backup DB
  → prisma migrate deploy
  → production rollout (API then Web)
  → post-deploy smoke
  → monitor (logs, /ready, 5xx, latency)
```

Documented workflows:

- CI: `.github/workflows/ci.yml` (PR + `main`)
- Release images: `.github/workflows/release.yml` (`workflow_dispatch` and tags `v*.*.*`)

## Version tags (convention)

| Tag | Meaning | Create now? |
|-----|---------|-------------|
| `v1.0.0-rc.1` | Release candidate logical / first RC | **No** — assess only until human approval |
| `v1.0.0` | First production release | **No** until GO |

### How `release.yml` versions images

On tag push `v*.*.*`:

- `version` = tag name (e.g. `v1.0.0`)
- also tag `: <full git sha>`
- images: `ghcr.io/<owner>/<repo>-api` and `...-web`

On `workflow_dispatch` without tag:

- `version` = `sha-<12>`
- publish only if `publish=true`

**Do not** create remote tags from this phase without explicit human approval.

## RC assessment criteria

A commit is a logical **RC** when:

1. CI-equivalent local gates are green (Prisma, lint, unit, e2e, builds, Docker, audit high).
2. Migration gate on empty PostgreSQL 17 succeeds.
3. No BLOCKER / unmitigated HIGH security issues.
4. No secrets in tracked files.
5. Staging readiness docs + checklists exist.
6. Rollback image strategy is documented (previous SHA).
7. Seed safety: demo seeds blocked in production.

## Rollback (application)

1. Identify previous known-good image SHA (`*-api:<sha>`, `*-web:<sha>`).
2. Stop progressive rollout / pin traffic to previous revision.
3. Redeploy previous images (API then Web, or both).
4. Confirm DB compatibility (forward-only migrations — see below).
5. Verify `/health`, `/ready`, smoke login + critical flow.
6. Monitor 5xx and latency.

**Do not** run destructive `migrate reset` in production.

## Database rollback policy

Prisma migrations are **forward-only** in normal operations.

- Application rollback ≠ schema rollback.
- Prefer **expand/contract** and backward-compatible migrations.
- Before risky migrations: take a verified backup.
- If a migration fails mid-deploy: **stop**; do not continue API rollout; restore from backup only with a rehearsed procedure and human approval.
- Do not rewrite applied historical migrations except for an explicit BLOCKER with a coordinated fix-forward plan.

## Backup & restore

### Backup (PostgreSQL)

```bash
export DATABASE_URL='postgresql://USER:PASS@HOST:PORT/DB?schema=public'
pnpm db:backup
# → backups/talento-<UTC>.dump  (gitignored)
```

| Item | Suggestion (starting point — adjust to risk) |
|------|-----------------------------------------------|
| Frequency | Daily full logical dump; pre-migration extra dump |
| Retention | Staging ≥7 days; production ≥30 days (policy TBD with ops) |
| Security | Store off-host; encrypt at rest if using object storage; restrict ACLs |
| Validation | Periodic restore drill on a **separate** database |

This repository provides scripts; it does **not** claim hosted backup infrastructure exists until provisioned.

### Restore drill (separate DB)

```bash
# 1) Backup source (non-prod)
pnpm db:backup

# 2) Restore into a disposable DB (see scripts/restore-postgres.sh)
export DATABASE_URL='postgresql://.../talento_restore_drill'
pnpm db:restore backups/talento-<UTC>.dump

# 3) Point a temporary API at the restored URL; verify:
curl -fsS "$API/health"   # 200
curl -fsS "$API/ready"    # 200
```

Never restore production dumps onto developer laptops without redaction/approval.

## GO / NO-GO

### Automatic NO-GO if any of:

- Critical test suite red (unit/e2e/web below baseline or failing)
- Migration failure on target
- BLOCKER defect open
- HIGH security issue unmitigated
- Secret exposed in repo/images/logs
- `/ready` semantics broken (reports ready when DB down, or vice versa incorrectly)
- Tenant isolation broken
- Docker image not reproducible from clean context
- No identifiable rollback image

### GO only when:

- Staging smoke checklist passed
- Production pre-flight checklist complete
- Named rollout owner + window
- Monitoring/alerting path available (even if basic: logs + `/ready`)

## Related checklists

- [checklists/staging-smoke.md](./checklists/staging-smoke.md)
- [checklists/production-preflight.md](./checklists/production-preflight.md)
- [checklists/post-deploy.md](./checklists/post-deploy.md)
