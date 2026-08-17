# Performance Core (08A)

Configuración del módulo Performance: ciclos, competencias y escalas.

Evaluaciones / participantes: ver [performance-evaluations.md](./performance-evaluations.md) (08B).

## Dominio

Performance reutiliza `Employee` y Organization existentes. No hay entidad persona paralela.
En 08A solo se configura el marco de evaluación.

`EmployeeReportingLine` de tipo `DIRECT` es el candidato usado en 08B para evaluación de líder. El ciclo **no** se acopla a managers en 08A.

## Modelos

| Modelo | Rol |
|--------|-----|
| `PerformanceCycle` | Periodo de evaluación (DRAFT → ACTIVE → CLOSED / CANCELLED) |
| `Competency` | Catálogo por Company (soft-delete via `deletedAt`) |
| `CompetencyScale` | Escala configurable por Company |
| `CompetencyScaleLevel` | Niveles (`value`, `label`, `order`) |
| `PerformanceCycleCompetency` | Competencia + escala (+ weight) en un ciclo |

### Relación Competency ↔ Scale

- `Competency.defaultScaleId` (nullable): escala por defecto sugerida.
- `PerformanceCycleCompetency.scaleId`: escala efectiva en el ciclo (puede sobrescribir el default).
- Una Company puede tener varias escalas; distintas competencias pueden usar distintas escalas.

## PerformanceCycle

Campos: `name`, `description?`, `startDate`, `endDate`, `evaluationStartDate?`, `evaluationEndDate?`, `status`, `createdByUserId`.

### Fechas

- `startDate <= endDate` (CHECK SQL + validación app).
- Fechas de evaluación: ambas null **o** ambas set.
- Si set: `evaluationStart <= evaluationEnd` y la ventana debe caer dentro del periodo del ciclo.

### Status / transition matrix

| Desde | Hacia |
|-------|-------|
| DRAFT | ACTIVE, CANCELLED |
| ACTIVE | CLOSED, CANCELLED |
| CLOSED | — (terminal) |
| CANCELLED | — (terminal) |

No se permite ACTIVE → DRAFT. Transiciones vía endpoints explícitos (`activate` / `close` / `cancel`), no PATCH de status arbitrario.

### Editability

| Status | Metadata | Competencias del ciclo |
|--------|----------|------------------------|
| DRAFT | editable | configurable |
| ACTIVE | bloqueado | bloqueado |
| CLOSED | read-only | read-only |
| CANCELLED | read-only | read-only |

## Competency

- Unicidad: `UNIQUE(companyId, name)`, `UNIQUE(companyId, code)` (NULL codes permitidos en PG).
- Cross-company: mismo nombre válido.
- Status: `OrganizationEntityStatus` ACTIVE/INACTIVE.
- Sin delete físico.

## CompetencyScale / Levels

- Escala configurable; **no** hardcode 1–5.
- `UNIQUE(scaleId, value)`, `UNIQUE(scaleId, order)`.
- CHECK: `value >= 0`, `order >= 0`.
- DELETE de level permitido solo si la escala **no** está asociada a ciclos ACTIVE/CLOSED.

## Cycle competencies

`PerformanceCycleCompetency`: `cycleId`, `competencyId`, `scaleId`, `weight?`, `order`, `required`.
Representa: “esta competencia se evalúa en este ciclo con esta escala”.
DELETE elimina solo la relación, no la Competency global.
Solo editable en DRAFT.

Organizational defaults live on `JobLevelCompetency` (see [organization.md](./organization.md)). Cycles do **not** auto-import them in this phase.

## Weight semantics

- `weight` = `Decimal(5,2)` nullable.
- Si **ninguna** competencia tiene weight → evaluación no ponderada (OK al activar).
- Si **alguna** tiene weight → **todas** deben tenerlo y la suma debe ser exactamente **100** al activar.
- En DRAFT no se exige suma 100 (permite configuración parcial).

## Activation validation

Antes de ACTIVE:

1. ≥ 1 competencia en el ciclo.
2. Cada competencia ACTIVE (no deleted).
3. Cada escala ACTIVE con ≥ 2 niveles.
4. Regla de weights (arriba).

Concurrencia: `updateMany` condicional DRAFT→ACTIVE; segundo request → 409.

## Multi-tenancy

- `companyId` solo desde `TenantContext` (`X-Company-Id`). Nunca en DTO.
- Cycle, Competency, Scale y join deben ser de la misma Company.
- Cross-tenant → 404.

## RBAC

| Permission | CLIENT_ADMIN | PERFORMANCE_MANAGER | LEADER | COLLABORATOR | RECRUITER |
|------------|--------------|---------------------|--------|--------------|-----------|
| `performance.cycle.read` | ✓ | ✓ | ✓ | ✓ | — |
| `performance.cycle.manage` | ✓ | ✓ | — | — | — |
| `performance.competency.read` | ✓ | ✓ | ✓ | ✓ | — |
| `performance.competency.manage` | ✓ | ✓ | — | — | — |
| `performance.scale.read` | ✓ | ✓ | ✓ | ✓ | — |
| `performance.scale.manage` | ✓ | ✓ | — | — | — |

## Audit

Eventos: `PERFORMANCE_CYCLE_*`, `COMPETENCY_*`, `COMPETENCY_SCALE_*`, `COMPETENCY_SCALE_LEVEL_*`, `CYCLE_COMPETENCY_*`.
Metadata mínima: IDs (sin textos largos).

## Endpoints

### Cycles

- `POST/GET /performance/cycles`
- `GET/PATCH /performance/cycles/:id`
- `POST /performance/cycles/:id/activate|close|cancel`
- `GET/POST /performance/cycles/:id/competencies`
- `PATCH/DELETE /performance/cycles/:id/competencies/:competencyId`

### Competencies

- `POST/GET /performance/competencies`
- `GET/PATCH /performance/competencies/:id`

### Scales

- `POST/GET /performance/scales`
- `GET/PATCH /performance/scales/:id`
- `POST /performance/scales/:id/levels`
- `PATCH/DELETE /performance/scales/:id/levels/:levelId`

## Frontend (08A)

Rutas admin:

- `/performance/cycles` (+ detalle)
- `/performance/competencies`
- `/performance/scales` (+ detalle/niveles)

Query keys: `["performance", companyId, ...]`.

## Snapshots (08B)

Al materializar una evaluación se snapshottea (relacional):

- competency name / description / weight / order
- scale name + levels

Ver [performance-evaluations.md](./performance-evaluations.md).

## Qué NO incluye 08A

Evaluations, assignments, self/manager/peer/360, goals/OKRs, ratings, calibración, feedback, PDP, IA, notificaciones, PDF, jobs.
