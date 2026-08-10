# Release notes draft — V1.0.0

**Status:** Draft only. Not published. Tag `v1.0.0` not created in this phase.

## Summary

First production-ready candidate of **Talento sin clave**: multi-tenant HR platform with ATS, Performance, and Goals/OKRs, hardened auth, portable Docker deploy path, CI, and observability baselines.

## Modules (existing)

### Platform core

- Multi-company tenancy with `X-Company-Id` membership checks
- RBAC: company roles + permissions catalog (`db:seed`)
- Organization: employees / structure APIs and frontend surfaces

### Authentication & security

- Access JWT (memory on web) + refresh token in HttpOnly cookie (`tsc_refresh`)
- Refresh rotation and reuse detection
- CORS allowlist, Origin checks on auth mutations, Helmet, throttle
- Production fail-fast env validation for secrets/CORS
- Sanitized error responses; request correlation via `X-Request-Id`

### ATS

- Vacancies, vacancy requests, candidates, applications
- Interviews, offers, hiring flows (through Hiring 06B)
- Browser STT support (Whisper local/WASM deferred)

### Performance

- Cycles, competencies, scales, participants
- Evaluations, responses, results, analytics (08A–08E)

### Goals / OKRs

- Cycles, goals, progress/check-ins, completion, performance integration (09A–09E)

### Frontend

- Next.js App Router shell
- Auth session bootstrap via cookie refresh
- Organization, ATS, Offers/Hiring, Performance, Goals UIs

## Infrastructure & operations

- PostgreSQL 17 + Prisma migrate deploy
- Multi-stage Docker images (API + Web standalone), non-root where applicable
- Production-like compose + nginx example
- Backup/restore scripts (`pnpm db:backup` / `pnpm db:restore`)
- Health (`/health`) vs readiness (`/ready`) contract
- Structured JSON logs, redaction policy, Prometheus metrics (`/metrics` private)
- GitHub Actions CI + optional GHCR release workflow (no auto-deploy)

## What is intentionally out of V1.0

- Hosted cloud provisioning / DNS / real staging cloud
- Whisper local/WASM, diarization, AI scoring
- Same-origin `/api` reverse-proxy implementation inside the Next app
- Access-token server-side revocation on every request after logout (TTL-bound)
- Pinning all GitHub Actions to full commit SHAs (documented debt)

## Upgrade / install notes

1. Require Node per `.nvmrc` / engines; pnpm via `packageManager`.
2. Configure secrets from `infrastructure/.env.prod.example` (never commit).
3. `migrate deploy` → optional `db:seed` (RBAC) → start API/Web.
4. Do **not** run `db:seed:dev` / `db:seed:qa` in production.
