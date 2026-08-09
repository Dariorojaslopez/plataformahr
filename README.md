# Talento sin clave

Monorepo de la plataforma de talento (ATS + Performance).

## Arquitectura

```text
talento-sin-clave/
├── apps/
│   ├── api/                 # NestJS + Prisma (API REST)
│   └── web/                 # Next.js (App Router) + Tailwind
├── packages/
│   └── shared/              # Tipos y utilidades compartidas
├── docs/                    # Auth, multi-tenancy, organization, ATS, Performance
└── infrastructure/
    └── docker-compose.yml   # PostgreSQL 17
```

| Capa | Tecnología | Puerto |
|------|------------|--------|
| Web | Next.js 16, TypeScript, Tailwind | 3000 |
| API | NestJS 11, Prisma | 3001 |
| DB | PostgreSQL 17 | 5433→5432 |

## Configuración

```bash
cp .env.example apps/api/.env
# Configura JWT_*, CORS_ORIGINS y, si vas a probar auth, DEV_* credentials.
```

Documentación:

- [docs/authentication.md](docs/authentication.md)
- [docs/multi-tenancy.md](docs/multi-tenancy.md)
- [docs/organization.md](docs/organization.md)
- [docs/performance-core.md](docs/performance-core.md)
- [docs/performance-evaluations.md](docs/performance-evaluations.md)
- [docs/performance-responses.md](docs/performance-responses.md)
- [docs/performance-results.md](docs/performance-results.md)
- [docs/performance-analytics.md](docs/performance-analytics.md)
- [docs/goals-core.md](docs/goals-core.md)
- [docs/goals-progress.md](docs/goals-progress.md)
- [docs/goals-completion.md](docs/goals-completion.md)
- [docs/ats-vacancies.md](docs/ats-vacancies.md)
- [docs/ats-candidates.md](docs/ats-candidates.md)
- [docs/ats-interviews.md](docs/ats-interviews.md)
- [docs/frontend-auth.md](docs/frontend-auth.md)
- [docs/frontend-organization.md](docs/frontend-organization.md)
- [docs/frontend-ats.md](docs/frontend-ats.md)
- [docs/frontend-interviews.md](docs/frontend-interviews.md)

## Ejecución

```bash
pnpm install
pnpm db:generate
pnpm --filter @talento/shared build
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm db:seed:dev   # solo desarrollo; requiere DEV_* en .env
```

En terminales separadas:

```bash
pnpm dev:api
pnpm dev:web
```

- API: http://localhost:3001
- Auth / Organization / ATS / Performance 08A–08E / Goals 09A–09C + frontend bajo JWT + `X-Company-Id`

## Alcance actual

Incluye: multi-tenant core, auth JWT/sesiones, organización API, ATS completo hasta Hiring 06B, STT browser (Fase 07), **Performance 08A–08E**, **Goals/OKRs 09A–09C** (periodos, check-ins, progreso operacional, cierre formal, achievement inmutable, team DIRECT, revisión de cierres), frontend shell/Organization/ATS/Offers/Hiring/Performance/Goals.

Pendiente: integración Goals↔Performance (09D), Whisper local/WASM, diarización/IA, cookies HttpOnly para refresh, endpoint de permissions efectivos, analytics anónimos (minimum cohort size).

Docs: [docs/ats-offers.md](docs/ats-offers.md) · [docs/ats-hiring.md](docs/ats-hiring.md) · [docs/stt.md](docs/stt.md) · [docs/performance-core.md](docs/performance-core.md) · [docs/performance-evaluations.md](docs/performance-evaluations.md) · [docs/performance-responses.md](docs/performance-responses.md) · [docs/performance-results.md](docs/performance-results.md) · [docs/performance-analytics.md](docs/performance-analytics.md) · [docs/goals-core.md](docs/goals-core.md) · [docs/goals-progress.md](docs/goals-progress.md) · [docs/goals-completion.md](docs/goals-completion.md)
