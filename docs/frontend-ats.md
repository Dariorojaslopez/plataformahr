# Frontend — ATS (Phase 05C)

UI de Vacancy Requests, Vacancies, Candidates, Applications y Pipeline sobre la API ATS real.

## Alcance

- Solicitudes de vacante (**Crear proceso de selección** / **Mis procesos de selección** para el líder): listado, create/edit (DRAFT), submit, approve/reject, detalle + flujo. En el front del líder la página muestra solo los procesos creados por ese líder y una sección aparte de solicitudes donde es aprobador. El checkbox “Pendientes de mi aprobación” se eliminó. El formulario (Administrador en `/ats/vacancy-requests` y Líder en Inicio) muestra los niveles globales bloqueados, permite agregar/editar/eliminar extras de esa solicitud y ya no incluye el checkbox de Gerencia General.
- Configuración ATS:
  - **Niveles de aprobación por defecto** (`/ats/settings/approvals`) — cargo + colaborador activo del cargo (si hay más de uno, se elige el nombre)
  - **Evaluadores por defecto** (`/ats/settings/evaluators`) — igual: no hace falta que el colaborador tenga usuario de acceso para guardar; si no lo tiene, el nombre muestra “(sin acceso)”
  - **Procesos activos** (`/ats/settings/active-processes`) — editar niveles/evaluadores de un proceso en curso si aún no decidieron o evaluaron
- Vacantes: listado (el reclutador solo ve procesos asignados), detalle, transiciones de estado (PATCH), **Publicar**, etiqueta publicada/no publicada y **Preview** (`/ats/vacancies/:id/preview`) de la página pública con datos del cargo.
- Página pública de vacante: información del cargo + formulario con **carga de CV** y prellenado de datos.
- Candidatos: listado, create/edit, detalle, postulación a vacante OPEN
- Aplicaciones: detalle + historial de etapas
- Entrevistas: pendientes agrupadas por proceso (`GET /ats/interviews/pending`), plantilla por proceso y formulario de evaluación con estado de fase.
- Pipeline/Kanban por vacante (`?vacancyId=`): 4 columnas (Nuevo, Entrevista Equipo de Atracción, Entrevista Evaluadores, Contratado), semáforo de ajuste, HV y popup de contratación.

**No incluido:** El PDI de Performance aún no se genera: si la compañía tiene `premium.pdi`, el Kanban avisa que se programará al contratar.

## API layer

`apps/web/src/lib/api/ats.ts` (`atsApi` + `atsKeys`).

Consume solo endpoints existentes bajo `/ats/...`. Auth y `X-Company-Id` vía client central.

## Query / cache

TanStack Query. Keys tenant-aware: `["ats", companyId, ...]`.

`TenantCacheBoundary` limpia el cache al cambiar `activeCompanyId`.

Invalidación tras mutaciones con `atsKeys.all(companyId)`.

## Transition matrix (UI)

Replica la matriz backend. El Kanban del reclutador agrupa etapas en 4 columnas: **Nuevo** (`PENDING_REVIEW`/`CONTACTED`), **Entrevista Equipo de Atracción** (`INTERVIEW`), **Entrevista Evaluadores** (`OFFER`) y **Contratado** (`HIRED`). `REJECTED`/`WITHDRAWN` no son columnas; se descarta desde el menú.

| From | To |
|------|-----|
| PENDING_REVIEW | CONTACTED, INTERVIEW, REJECTED, WITHDRAWN |
| CONTACTED | INTERVIEW, REJECTED, WITHDRAWN |
| INTERVIEW | OFFER, REJECTED, WITHDRAWN |
| OFFER | REJECTED, WITHDRAWN |
| HIRED / REJECTED / WITHDRAWN | — |

`HIRED` no se asigna con `move`: al soltar en Contratado se abre un popup de requisitos y se llama `POST /ats/applications/:id/hire` (oferta aceptada + cupo).

Vacancy status: OPEN↔PAUSED, OPEN/PAUSED→CLOSED|CANCELLED; terminales sin acciones.

Drag & drop (`@dnd-kit`) solo permite destinos válidos del Kanban. Menú **Mover a…** siempre disponible (a11y/mobile). Las tarjetas muestran nombre + semáforo de ajuste (`fitLevel`).

## Labels

Centralizados en `apps/web/src/lib/ats/labels.ts` (stages, statuses, approval steps).
Timeline de solicitudes: `apps/web/src/lib/ats/approval-timeline.ts` (nombres, no UUID; pendiente vs esperando).

## RBAC limitation

No hay endpoint de permissions efectivos para ocultar navegación. En **detalle de solicitud**, Aprobar/Rechazar se muestran solo si la API envía `currentUserCanDecide: true` (paso actual + actor concreto). El listado del líder usa `requestedByEmployeeId` (mis procesos) y `pendingMyApproval=true` (como aprobador). El backend sigue siendo autoritativo.

## Responsive

- Listas: tabla desktop / cards mobile
- Kanban: scroll horizontal; menú de movimiento en mobile (DnD no obligatorio)

## Empty states

Textos cortos (sin datos ficticios), p. ej. “Aún no hay solicitudes de vacante.” El reclutador sin procesos asignados ve “No hay procesos asignados a ti.”
