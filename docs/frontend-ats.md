# Frontend — ATS (Phase 05C)

UI de Vacancy Requests, Vacancies, Candidates, Applications y Pipeline sobre la API ATS real.

## Alcance

- Solicitudes de vacante: listado, create/edit (DRAFT), submit, approve/reject, detalle + flujo
- Configuración ATS: **Aprobación de solicitudes** (`/ats/settings/approvals`) — pasos secuenciales por compañía
- Vacantes: listado, detalle, transiciones de estado (PATCH)
- Candidatos: listado, create/edit, detalle, postulación a vacante OPEN
- Aplicaciones: detalle + historial de etapas
- Pipeline/Kanban por vacante (`?vacancyId=`)

**No incluido:** Interviews UI, micrófono, transcripción, Offer/Contract/Hiring, CV parsing.

## API layer

`apps/web/src/lib/api/ats.ts` (`atsApi` + `atsKeys`).

Consume solo endpoints existentes bajo `/ats/...`. Auth y `X-Company-Id` vía client central.

## Query / cache

TanStack Query. Keys tenant-aware: `["ats", companyId, ...]`.

`TenantCacheBoundary` limpia el cache al cambiar `activeCompanyId`.

Invalidación tras mutaciones con `atsKeys.all(companyId)`.

## Transition matrix (UI)

Replica la matriz backend:

| From | To |
|------|-----|
| PENDING_REVIEW | CONTACTED, REJECTED, WITHDRAWN |
| CONTACTED | INTERVIEW, REJECTED, WITHDRAWN |
| INTERVIEW | OFFER, REJECTED, WITHDRAWN |
| OFFER | HIRED, REJECTED, WITHDRAWN |
| HIRED / REJECTED / WITHDRAWN | — |

Vacancy status: OPEN↔PAUSED, OPEN/PAUSED→CLOSED|CANCELLED; terminales sin acciones.

Drag & drop (`@dnd-kit`) solo permite destinos válidos. Menú **Mover a…** siempre disponible (a11y/mobile).

## Labels

Centralizados en `apps/web/src/lib/ats/labels.ts` (stages, statuses, approval steps).
Timeline de solicitudes: `apps/web/src/lib/ats/approval-timeline.ts` (nombres, no UUID; pendiente vs esperando).

## RBAC limitation

No hay endpoint de permissions efectivos para ocultar navegación. En **detalle de solicitud**, Aprobar/Rechazar se muestran solo si la API envía `currentUserCanDecide: true` (paso actual + actor concreto). El listado puede filtrar `pendingMyApproval=true`. El backend sigue siendo autoritativo.

## Responsive

- Listas: tabla desktop / cards mobile
- Kanban: scroll horizontal; menú de movimiento en mobile (DnD no obligatorio)

## Empty states

Textos cortos (sin datos ficticios), p. ej. “Aún no hay solicitudes de vacante.”
