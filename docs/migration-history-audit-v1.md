# Migration history audit — V1 RC

Scope: all folders under `apps/api/prisma/migrations/`.

## Method

- Grep for `DROP `, `TRUNCATE `, `DELETE FROM` in `*.sql`
- Review for env-dependent SQL and embedded seed data
- Confirm empty-DB `prisma migrate deploy` applies cleanly (migration gate)

## Findings

| Risk class | Result |
|------------|--------|
| Destructive DROP/TRUNCATE in history | **None found** in SQL migrations at audit time |
| Embedded demo user seeds in migrations | **None** — demo data via `seed.dev` / `seed.qa` only |
| Env-dependent SQL | **None observed** |
| `db push` as release path | **Forbidden** by docs/CI; deploy uses migrate |

## Residual notes

- Forward-only policy: do not rewrite applied migrations.
- Before future destructive schema changes: expand/contract + backup + staging rehearsal.
- Index review: rely on Prisma schema `@@index` / unique constraints; no speculative index PR in RC without query evidence.

## Empty-DB gate (procedure)

```bash
# Disposable DB
createdb talento_migrate_gate   # or compose postgres
export DATABASE_URL=postgresql://.../talento_migrate_gate
pnpm db:migrate:deploy
pnpm db:seed                    # RBAC catalog only
# start API → curl /health /ready
```
