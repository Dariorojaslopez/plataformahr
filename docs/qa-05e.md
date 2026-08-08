# QA Fase 05E — Integration UX + E2E product flow

Auditoría de integración sobre lo construido hasta 05D.
**No** agrega módulos Offer / Hiring / STT.
Fecha de cierre de auditoría: 2026-08-08.

## Baseline inicial

| Check | Resultado |
| --- | --- |
| `pnpm lint` | OK |
| `pnpm test` (web) | 44 |
| `pnpm test` (api unit) | 14 |
| `pnpm test` (shared) | 2 |
| `pnpm test:e2e` | 61 (1 flaky `ats-vacancy` en 1er run; re-run 61/61) |
| `pnpm build:api` | OK |
| `pnpm build:web` | OK |

Los números coinciden con lo esperado (API unit 14, e2e 61, web 44) más 2 tests shared existentes.

## Verificación final (post-fixes)

| Check | Resultado |
| --- | --- |
| `pnpm lint` | OK |
| `pnpm test` (web) | **49** (+5: safe-url, ats-keys) |
| `pnpm test` (api unit) | 14 |
| `pnpm test` (shared) | 2 |
| `pnpm test:e2e` | 61/61 |
| `pnpm build:api` | OK |
| `pnpm build:web` | OK (`NODE_ENV=production`; falló si `NODE_ENV=development` en el shell) |
| Tenant API A↔B | Marker `BU-B` solo en Company B; sin leak a A |

## Entorno DEV

- PostgreSQL healthy
- API `GET /health` → 200
- Web `/login` → 200
- Seed QA 2ª compañía: `pnpm db:seed:qa` (`apps/api/prisma/seed.qa.ts`, bloqueado en `NODE_ENV=production`)

## Issue log

| ID | Área | Severidad | Descripción | Resolución | Estado |
| --- | --- | --- | --- | --- | --- |
| QA-01 | Approvals UX | HIGH | Timeline de aprobación mostraba UUID / “Approver employee” / `userId` en inglés cuando faltaba identidad enriquecida | Enriquecer con `employeesQuery` existente; fallback legible sin inventar nombres; `CLIENT_ADMIN` → “Administrador de compañía” | FIXED |
| QA-02 | Vacancies labels | HIGH | Columna/labels “Filled” / “Headcount” en UI española | Renombrar a “Cubiertas” / “Plazas” en listados y detalle | FIXED |
| QA-03 | Vacancies semantics | MEDIUM | `filledCount` podía leerse como contratación formal | Texto aclaratorio en detalle: cobertura de vacante, no Hiring | FIXED |
| QA-04 | Org labels | MEDIUM | Inconsistencia empleado/Headcount vs colaborador/plazas | Unificar labels UI: colaborador, plazas | FIXED |
| QA-05 | Feedback | MEDIUM | Falta feedback de éxito discreto en mutaciones clave | `sonner` + `notifySuccess`/`notifyError` en flujos ATS/org críticos | FIXED |
| QA-06 | Double-submit | MEDIUM | Status plantilla, delete reporting line y DnD pipeline sin guard pending | `disabled={isPending}` / early return en `requestMove` | FIXED |
| QA-07 | Dates | MEDIUM | `birthDate`/`hireDate` como ISO slice | `formatDateShort` | FIXED |
| QA-08 | Security | LOW | `meetingUrl` como texto; riesgo de esquemas no http(s) si se linkea | `safeHttpUrl` + link solo http/https | FIXED |
| QA-09 | Navigation | LOW | Active nav no marcaba rutas hijas (`/employees/[id]`) | `pathname.startsWith(href + "/")` | FIXED |
| QA-10 | Auth deuda | LOW | Refresh en `sessionStorage` (no HttpOnly cookie) | Documentado; single-flight OK; logout/refresh failure limpian sesión. **No migrar en 05E** | DEBT |
| QA-11 | Approvals contract | MEDIUM | Backend no siempre expone identidad enriquecida del aprobador | UX aceptable con enriquecimiento FE; endpoint nuevo = deuda contractual | DEBT |
| QA-12 | Tenant QA data | MEDIUM | Seed base solo 1 company | Seed QA separado `seed.qa.ts` + `db:seed:qa` | FIXED |
| QA-13 | Auth security | BLOCKER | Submit nativo GET del login podía poner email/password en query string | `method="post"` + `preventDefault`; test `login-form-safety.test.ts`. Requiere rebuild/`next start` para verlo en prod local | FIXED |
| QA-14 | Auth test | LOW | Regression del method=post del login | `apps/web/src/lib/auth/login-form-safety.test.ts` | FIXED |

## No hallado / confirmado OK

- Sin implementación accidental STT/MediaRecorder/audio upload/S3/Whisper.
- `refreshToken` no está en `localStorage` (sí en `sessionStorage`; deuda documentada).
- ComingSoon solo en rutas no implementadas (`/performance`).
- Backend sigue validando transiciones de pipeline.
- No Offer automático al completar entrevista.

## Deuda contractual / diferida

1. **HttpOnly cookies** para refresh (docs auth existentes).
2. **Aprobaciones**: enriquecer identidad en contrato API si el FE no puede resolver vía employees list (N+1 / permisos).
3. **Offer / Hiring / STT**: fuera de alcance hasta fases posteriores.

## Regression tests agregados

- `apps/web/src/lib/ui/safe-url.test.ts`
- `apps/web/src/lib/api/ats-keys.test.ts`
- `apps/web/src/lib/auth/login-form-safety.test.ts`
- (existentes) session-store refresh no-localStorage; org query keys tenant

> Nota: web tests post-fixes ≈ **50** (+ login-form-safety). Web local puede estar abajo tras reinicio interrumpido; API `/health` OK.

## Smoke E2E esperado

LOGIN → COMPANY → ORGANIZATION → POSITION → VACANCY REQUEST → APPROVAL → VACANCY → CANDIDATE → APPLICATION → PENDING_REVIEW → CONTACTED → INTERVIEW → WORKSPACE → EVALUATION → TRANSCRIPT → INTERVIEW COMPLETED  
Sin Offer / Hiring / Employee-from-Candidate / audio.
