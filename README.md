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
├── docs/                    # Autenticación y multi-tenancy
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
- Health: http://localhost:3001/health
- Auth: `POST /auth/login`, `GET /auth/me`
- Tenant sample: `GET /companies/current` con `Authorization` + `X-Company-Id`
- Platform sample: `GET /platform/me` (Platform Owner)

## Scripts raíz

| Script | Descripción |
|--------|-------------|
| `dev:api` / `dev:web` | Dev servers |
| `infra:up` / `infra:down` / `infra:logs` | Docker Compose (PostgreSQL 17) |
| `db:generate` / `db:migrate` / `db:seed` | Prisma base |
| `db:seed:dev` | Usuarios/compañía de desarrollo (no production) |
| `lint` / `test` / `test:e2e` / `build` | Calidad y builds |

## Alcance actual

Incluye: monorepo, API NestJS, web Next.js, Prisma multi-tenant, autenticación JWT + sesiones, tenant context, RBAC por permissions, seed RBAC + seed DEV, `GET /health`.

Pendiente: cookies/SSO, Employee, Organization, ATS, Performance, proxy Platform Owner.
