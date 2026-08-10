# Operations runbook (portable)

Companion to [production-infrastructure.md](./production-infrastructure.md), [staging.md](./staging.md), and [release.md](./release.md). No cloud-vendor assumptions.

## Deploy (conceptual)

1. Build images (`talento-api`, `talento-web`) from a clean git revision.
2. Push/tag externally when a registry exists (not in this phase).
3. Ensure secrets available in the runtime environment (not in Git).
4. **Run migrations once** against the target DB (`migrate deploy`).
5. If migration fails → **stop**; do not roll out new API replicas.
6. Start/replace API, then Web.
7. Verify `/health`, `/ready`, and a smoke login if data exists.

## Migrate

```bash
# Local/prod-like compose
pnpm infra:prod:migrate

# Or host toolchain against a DATABASE_URL
pnpm db:migrate:deploy
```

Never use `prisma migrate dev` against production.

## Start / stop / restart

```bash
# DEV Postgres only
pnpm infra:up
pnpm infra:down

# Production-like stack
pnpm infra:prod:up
pnpm infra:prod:down

# Restart a single service
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod restart api
```

## Health checks

```bash
curl -fsS "$API_BASE/health"   # expect {"status":"ok"}
curl -fsS "$API_BASE/ready"    # expect {"status":"ready"} ; 503 if DB down
curl -fsSI "$WEB_BASE/"        # expect HTTP 200
# Metrics are internal — do not expose publicly
curl -fsS "$API_BASE/metrics" | head
```

## Find a request by requestId

1. Client 5xx message may include `Código de referencia: <id>`.
2. Response header `X-Request-Id` / JSON body `requestId`.
3. Search container stdout JSON logs for `"requestId":"<id>"`.

## Interpret 5xx

- Client body is sanitized (no stack/SQL).
- Correlate with logs via `requestId`.
- Check `/ready` and recent deploys/migrations.

## CI failure

See [ci-cd.md](./ci-cd.md). Re-run the failing job locally with the same Node/pnpm versions. Migration gate failures mean schema history is broken — fix-forward, do not edit applied migrations.

## Image rollback

Redeploy previous immutable image tags (`:<sha>` or `:vX.Y.Z`). Do not auto-rollback the database.

## Backup

```bash
export DATABASE_URL='postgresql://...'
pnpm db:backup
# → backups/talento-<UTC>.dump
```

Copy dumps off the machine. Schedule daily as a starting point.

## Restore

```bash
export DATABASE_URL='postgresql://.../temporary_db'
pnpm db:restore -- --yes ./backups/talento-XXXX.dump
```

Requires `--yes`. Prefer restore into a **temporary** database, validate, then cut over.

## Incident: DB unavailable

| Check | Expected |
|-------|----------|
| `/health` | May remain 200 |
| `/ready` | 503 |
| API business routes | Sanitized errors |
| Recovery | `/ready` returns 200 when DB is back |

Restart API only if connections are wedged after prolonged outage.

## Incident: bad environment

Production process **exits at startup** if secrets/CORS/DB URL fail validation (Fase 10). Fix env and recreate the container; do not weaken validators.

## Incident: migration failure

1. Do not deploy new application revision.
2. Capture Prisma error (ops logs).
3. Fix-forward with a new migration, or restore DB from backup if corrupted.
4. No automatic destructive DB rollback.

## Rollback (application)

- Redeploy previous **image tags** only if the database schema is still compatible.
- Application rollback ≠ database rollback.
- Prefer backward-compatible migrations.

## Secret rotation

After rotating `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`:

- Existing access/refresh tokens become invalid.
- Users must log in again.
- Rotate any credential that ever appeared in a historically tracked `.env` before go-live (see [security.md](./security.md)).

## Seed policy reminder

- `db:seed` (RBAC): explicit ops only.
- `db:seed:dev` / `db:seed:qa`: never in production.
- First Platform Owner: manual/ops process with vaulted password — no defaults.
