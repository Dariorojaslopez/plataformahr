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
├── docs/                    # Auth, multi-tenancy, organization, ATS
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
- [docs/ats-vacancies.md](docs/ats-vacancies.md)
- [docs/ats-candidates.md](docs/ats-candidates.md)
- [docs/ats-interviews.md](docs/ats-interviews.md)
- [docs/frontend-auth.md](docs/frontend-auth.md)

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
- Auth / Organization / ATS (API) + frontend foundation (login, tenant, app shell) bajo JWT + `X-Company-Id`

## Alcance actual

Incluye: multi-tenant core, auth JWT/sesiones, organización, ATS 04A–04C, y frontend 05A (design system, auth/session, shell, dashboard, placeholders).

Pendiente: CRUD UI Organization/ATS, CV/AI/speech-to-text/oferta/contratación, Performance, SSO, cookies HttpOnly para refresh.
