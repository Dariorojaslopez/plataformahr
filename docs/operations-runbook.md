# Operations runbook (portable)

Companion to [production-infrastructure.md](./production-infrastructure.md), [staging.md](./staging.md), [release.md](./release.md), and [ci-cd.md](./ci-cd.md).

## Deploy (production VPS)

Automatic: `git push origin main` → all CI jobs green → GitHub Environment `production` → SSH → `scripts/deploy-prod.sh <sha>`.

Directory: `/opt/plataforma-hr`. Runtime secrets: `infrastructure/.env.prod` (never in GitHub). User: non-root deploy user in the `docker` group. **Never** deploy as `root`.

```text
1. Refuse dirty working tree; git fetch; checkout --detach $SHA
2. Ensure postgres is up (volume talento_prod_pgdata kept)
3. Backup via postgres container → backups/talento-<UTC>-<sha12>.dump
4. IMAGE_TAG=$SHA docker compose build api web
5. docker compose run --rm --no-build migrate
   if fail → stop; do not roll out new API/Web
6. up -d --no-deps --no-build api, then web
7. curl API /health, API /ready, Web /
   if fail → application rollback to previous SHA images if they exist
```

Manual (same machine, same user):

```bash
/opt/plataforma-hr/scripts/deploy-prod.sh <full-git-sha>
```

Do **not** use `git pull` as the deploy mechanism.

## Migrate

Production CD uses the compose `migrate` service (`prisma migrate deploy` in the API image). Node/pnpm/Prisma are **not** required on the host.

```bash
# Lab / explicit
pnpm infra:prod:migrate

# Equivalent
docker compose -f infrastructure/docker-compose.prod.yml \
  --env-file infrastructure/.env.prod run --rm --no-build migrate
```

Never use `prisma migrate dev`, `prisma db push`, or `migrate reset` against production.

## Start / stop / restart

```bash
# DEV Postgres only
pnpm infra:up
pnpm infra:down

# Production-like lab stack (migrate completes before API because of depends_on)
pnpm infra:prod:up

# Restart a single service (does not remove volumes)
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod restart api
```

### Forbidden in production

```bash
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod down
docker compose -f infrastructure/docker-compose.prod.yml --env-file infrastructure/.env.prod down -v
```

`down -v` deletes `talento_prod_pgdata`. `pnpm infra:prod:down` is `down` without `-v` (containers/networks only) — **do not use it on the live VPS** as part of CD; it still stops PostgreSQL.

## Health checks

From the VPS (published compose ports; defaults 3001 / 3000):

```bash
curl -fsS "http://127.0.0.1:3001/health"   # expect {"status":"ok"}
curl -fsS "http://127.0.0.1:3001/ready"    # expect {"status":"ready"} ; 503 if DB down
curl -fsSI "http://127.0.0.1:3000/"        # expect HTTP 200
# Metrics are internal — do not expose publicly
curl -fsS "http://127.0.0.1:3001/metrics" | head
```

CD waits with retries (`HEALTH_ATTEMPTS` / `HEALTH_DELAY_SECS`, defaults 30×4s).

## Find a request by requestId

1. Client 5xx message may include `Código de referencia: <id>`.
2. Response header `X-Request-Id` / JSON body `requestId`.
3. Search container stdout JSON logs for `"requestId":"<id>"`.

## Interpret 5xx

- Client body is sanitized (no stack/SQL).
- Correlate with logs via `requestId`.
- Check `/ready` and recent deploys/migrations.

## CI failure

See [ci-cd.md](./ci-cd.md). Re-run the failing job locally with the same Node/pnpm versions. Migration gate failures mean schema history is broken — fix-forward, do not edit applied migrations. A red CI job on `main` **blocks** production deploy.

## Image rollback

```bash
/opt/plataforma-hr/scripts/rollback-prod.sh <previous-full-sha>
```

Requires `talento-api:<sha>` and `talento-web:<sha>` already present. Does **not** run migrations. Does **not** restore PostgreSQL. Prisma is forward-only: old images only work if the current schema is still compatible.

## Backup

CD pre-migrate dump (preferred in production):

`/opt/plataforma-hr/backups/talento-<UTC>-<sha12>.dump`

Copy dumps off the machine. Schedule an extra daily dump as a starting point.

Lab script (needs `pg_dump` on PATH and a reachable `DATABASE_URL` — not the internal compose hostname `postgres` from the host):

```bash
export DATABASE_URL='postgresql://...'
pnpm db:backup
```

## Restore

```bash
export DATABASE_URL='postgresql://.../temporary_db'
pnpm db:restore -- --yes ./backups/talento-XXXX.dump
```

Requires `--yes`. Prefer restore into a **temporary** database, validate, then cut over. Not invoked by deploy or rollback scripts.

## Incident: DB unavailable

| Check | Expected |
|-------|----------|
| `/health` | May remain 200 |
| `/ready` | 503 |
| API business routes | Sanitized errors |
| Recovery | `/ready` returns 200 when DB is back |

Restart API only if connections are wedged after prolonged outage.

## Incident: bad environment

Production process **exits at startup** if secrets/CORS/DB URL fail validation (Fase 10). Fix env and recreate the API container; do not weaken validators.

## Incident: migration failure

1. Do not deploy new application revision (script already stops before API rollout).
2. Capture Prisma error (ops logs).
3. Fix-forward with a new migration, or restore DB from backup if corrupted (human approval).
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
