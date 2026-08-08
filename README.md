# Talento sin clave

Monorepo de la plataforma de talento (ATS + Performance). Este bootstrap incluye frontend, backend, paquete compartido e infraestructura local.

## Arquitectura

```text
talento-sin-clave/
├── apps/
│   ├── api/                 # NestJS + Prisma (API REST)
│   └── web/                 # Next.js (App Router) + Tailwind
├── packages/
│   └── shared/              # Tipos y utilidades compartidas
└── infrastructure/
    └── docker-compose.yml   # PostgreSQL 17
```

| Capa | Tecnología | Puerto |
|------|------------|--------|
| Web | Next.js 16, TypeScript, Tailwind | 3000 |
| API | NestJS 11, Prisma | 3001 |
| DB | PostgreSQL 17 | 5432 |

Flujo local: `web` habla con `api` vía `NEXT_PUBLIC_API_URL`. La API usa `DATABASE_URL` (PostgreSQL).

### Requisitos

- Node.js >= 20
- pnpm 11+
- Docker con el plugin **Compose** (`docker compose version`)

> Si `docker compose` no está disponible, instala el plugin de Compose o Docker Desktop completo.

## Configuración

```bash
cp .env.example apps/api/.env
# Ajusta valores si es necesario. Los defaults coinciden con docker-compose.
```

## Ejecución

### 1. Instalar dependencias

```bash
pnpm install
pnpm db:generate
pnpm --filter @talento/shared build
```

### 2. Levantar infraestructura

```bash
pnpm infra:up
```

### 3. Desarrollo

En terminales separadas:

```bash
pnpm dev:api
pnpm dev:web
```

- API: http://localhost:3001
- Health: http://localhost:3001/health → `{ "status": "ok" }`
- Web: http://localhost:3000

### Infraestructura

```bash
pnpm infra:up      # PostgreSQL 17
pnpm infra:logs    # logs
pnpm infra:down    # detener
```

### Calidad

```bash
pnpm lint
pnpm test
pnpm build:api
pnpm build:web
```

## Scripts raíz

| Script | Descripción |
|--------|-------------|
| `dev:api` / `dev:web` | Dev servers |
| `infra:up` / `infra:down` / `infra:logs` | Docker Compose (PostgreSQL 17) |
| `db:generate` / `db:migrate` | Prisma |
| `lint` / `test` / `build` | Calidad y builds |

## Alcance actual (bootstrap)

Incluye: monorepo, API NestJS, web Next.js, `packages/shared`, Docker (PostgreSQL 17), Prisma base, `GET /health`.

Pendiente (no implementado aún): autenticación, tenants, users, ATS, Performance, modelo de datos completo.
