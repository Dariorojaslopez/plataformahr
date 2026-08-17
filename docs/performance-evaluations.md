# Performance Evaluations (08B)

Materialización de participantes y evaluaciones SELF/MANAGER con snapshots históricos.

Respuestas / submit / score individual: ver [performance-responses.md](./performance-responses.md) (08C).

Ver también: [performance-core.md](./performance-core.md) (08A).

## Dominio

Un `PerformanceCycle` en estado `ACTIVE` puede recibir `Employee`s como participantes.

Por cada participante se materializan:

1. **SELF** — autoevaluación (`employeeId === evaluatorEmployeeId`).
2. **MANAGER** — evaluación del líder `DIRECT` existente al momento de asignar (si existe).

`PerformanceCycleParticipant` es la entidad explícita de participación. Las evaluaciones no son el único indicador de “está en el ciclo”.

## Modelos

| Modelo | Rol |
|--------|-----|
| `PerformanceCycleParticipant` | Employee participa en un ciclo |
| `PerformanceEvaluation` | Evaluación SELF o MANAGER materializada |
| `PerformanceEvaluationCompetency` | Snapshot de competencia (+ escala) |
| `PerformanceEvaluationScaleLevel` | Snapshot de nivel de escala |

### Constraints

- `UNIQUE(cycleId, employeeId)` en participant.
- `UNIQUE(participantId, type)` → máximo una SELF y una MANAGER por participante (alcance 08B; no sobrearquitecta PEER/360).

## Enums

### `PerformanceParticipantStatus`

| Valor | Semántica |
|-------|-----------|
| `ACTIVE` | Participante vigente (default al asignar) |
| `COMPLETED` | Reservado para fin de proceso (sin lógica compleja en 08B) |
| `EXCLUDED` | Retiro administrativo (sin delete físico) |

### `PerformanceEvaluationType`

| Valor | Semántica |
|-------|-----------|
| `SELF` | El evaluado se evalúa a sí mismo |
| `MANAGER` | El evaluator es el DIRECT manager capturado al materializar |

### `PerformanceEvaluationStatus`

| Valor | Uso 08B |
|-------|---------|
| `PENDING` | Default al crear |
| `IN_PROGRESS` | Preparado para 08C |
| `SUBMITTED` | Terminal; bloquea exclude |

Matriz futura: `PENDING → IN_PROGRESS`, `PENDING → SUBMITTED`, `IN_PROGRESS → SUBMITTED`.

## SELF semantics

- `type = SELF`
- `employeeId` = persona evaluada
- **Decisión:** también se guarda `evaluatorEmployeeId = employeeId` para simplificar resource authorization y consultas “mis evaluaciones”.

## MANAGER semantics / resolution

Al materializar:

1. Buscar `EmployeeReportingLine` con `type = DIRECT` del employee, mismo tenant.
2. Manager debe existir, no soft-deleted, y preferiblemente ACTIVE.
3. Persistir `evaluatorEmployeeId` en la evaluación.
4. **No** recalcular después. Si cambia el reporting line, la evaluación histórica conserva al manager original.

## Employee without manager

- Sí puede participar.
- Se crea Participant + SELF.
- **No** se crea MANAGER.
- **No** hay fallback a CLIENT_ADMIN / PERFORMANCE_MANAGER.
- Respuesta incluye `managerEvaluationCreated: false` y razón `NO_DIRECT_MANAGER`.
- No hace rollback del Participant.

## Snapshot design

Preferencia: **snapshot relacional** (no JSON blob).

Autoridad histórica = texto/valores copiados en snapshot.
`sourceCompetencyId` / `sourceScaleId` / `sourceScaleLevelId` son trazabilidad **sin FK** al catálogo, para que cambios futuros no rompan historia.

SELF y MANAGER del mismo participant reciben la **misma** configuración (competencias, orden, weights, escalas, niveles).

### Competency snapshot

`name`, `code?`, `description?`, `weight?`, `required`, `order`, `sourceCompetencyId?`, `scaleName`, `sourceScaleId?`.

### Scale / level snapshot

Por competencia: `scaleName` + niveles `value`, `label`, `description?`, `order`, `sourceScaleLevelId?`.

## JobLevel competencies (organizational source, not yet applied)

Organization now stores live assignments `JobLevelCompetency` (Company → JobLevel ↔ Competency catalog).

**Current Performance behavior is unchanged:** a cycle still uses `PerformanceCycleCompetency` (manual per cycle). Participant materialization copies **that cycle list** into `PerformanceEvaluationCompetency`. It does not read job-level assignments.

Resolver prepared for a later change: `resolveCompetenciesForEmployee` (`apps/api/src/performance/job-level-competencies.ts`) walks Employee → Position.jobLevelId → JobLevelCompetency.

### Freeze boundary (do not violate)

| Moment | Reads live JobLevelCompetency? | Historical authority |
|--------|--------------------------------|----------------------|
| Cycle DRAFT competency config | Future: may *copy* into cycle | No |
| Cycle activate | No (validates cycle rows) | No |
| Participant / evaluation materialization | **No** today; this is the freeze | `PerformanceEvaluationCompetency` |
| Submit / calculate / close | No | Snapshots already stored |

Changing JobLevel competencies after evaluations exist **must not** rewrite evaluation snapshots. Catalog `Competency` edits also do not rewrite snapshots (`sourceCompetencyId` has no FK).

## Assignment transaction

Individual (`POST .../participants`):

```
BEGIN
  validar cycle ACTIVE + employee ACTIVE mismo tenant
  crear Participant
  congelar config del ciclo
  crear SELF + snapshot
  si DIRECT manager → crear MANAGER + snapshot
  Audit
COMMIT
```

Fallo en snapshot → rollback completo. Nunca Participant sin SELF ni Evaluation sin snapshot.

Solo ciclo `ACTIVE`. DRAFT / CLOSED / CANCELLED → rechazo (409/400 según caso).

## Bulk assignment

`POST .../participants/bulk` con `{ employeeIds }`.

- Síncrono (sin jobs).
- Dedup de input.
- IDs inválidos / cross-tenant / inactivos → **400 de todo el request** antes de crear (no creación parcial).
- Ya participantes → `alreadyAssigned` (idempotente).
- Nuevos → `created` (una sola TX).
- Warnings / `reason: NO_DIRECT_MANAGER` por ítem creado sin líder.

## Idempotency / concurrency

| Caso | Comportamiento |
|------|----------------|
| Individual duplicado | 409 + UNIQUE DB |
| Bulk ya asignado | `alreadyAssigned` |
| Race concurrente | UNIQUE + P2002 → 409 |

## Endpoints

```
GET    /performance/cycles/:cycleId/participants
GET    /performance/cycles/:cycleId/participants/:participantId
POST   /performance/cycles/:cycleId/participants
POST   /performance/cycles/:cycleId/participants/bulk
POST   /performance/cycles/:cycleId/participants/:participantId/exclude

GET    /performance/evaluations/mine
GET    /performance/evaluations/:id
```

`companyId` siempre desde `TenantContext`. Nunca en body.

### List participants

Filtros: `search`, `status`, `areaId`, `positionId`, `page`, `limit`.
Incluye employee, org, estados SELF/MANAGER, manager cuando exista.

### Mine

Resuelve `User` autenticado → `Employee` en la Company actual.
Si no hay Employee vinculado: `{ self: [], asManager: [] }` (colección vacía).
SELF: evaluado/evaluator; MANAGER: `evaluatorEmployeeId`.
Participantes `EXCLUDED` no aparecen.

### Evaluation detail

Snapshot completo ordenado. Cross-tenant → 404.

## Resource authorization

RBAC da capacidad general; resource auth decide **qué** evaluación.

| Actor | Acceso |
|-------|--------|
| `performance.evaluation.manage` | Tenant-wide (CLIENT_ADMIN / PERFORMANCE_MANAGER) |
| SELF | Solo su evaluación SELF |
| MANAGER | Solo donde `evaluatorEmployeeId == current Employee.id` |

IDOR vía URL: 403 (existencia oculta cuando aplica; cross-tenant 404).

## RBAC

| Permission | CLIENT_ADMIN | PERFORMANCE_MANAGER | LEADER | COLLABORATOR | RECRUITER |
|------------|--------------|---------------------|--------|--------------|-----------|
| `performance.evaluation.read` | ✓ | ✓ | ✓ | ✓ | — |
| `performance.evaluation.manage` | ✓ | ✓ | — | — | — |
| `performance.evaluation.respond` | ✓ | ✓ | ✓* | ✓* | — |

\* `respond` seeded para 08C; **sin endpoints de respuesta en 08B**. Resource auth limitará a evaluator/self.

## Exclusion

`POST .../exclude`: `ACTIVE → EXCLUDED`. No borra evaluations ni snapshots.
- Ya `EXCLUDED` → **409**.
- Alguna evaluación `SUBMITTED` → **400** (regla futura ya implementada).

## Audit

| Action | Metadata mínima |
|--------|-----------------|
| `PERFORMANCE_PARTICIPANT_ADDED` | cycleId, participantId, employeeId |
| `PERFORMANCE_PARTICIPANT_EXCLUDED` | cycleId, participantId, employeeId |
| `PERFORMANCE_EVALUATION_CREATED` | cycleId, participantId, employeeId, evaluationId, type |

Sin snapshot completo ni textos largos. Bulk audita por entidad creada.

## Frontend

| Ruta | UI |
|------|----|
| `/performance/cycles/[id]` | Tab Participantes + add / bulk / exclude |
| `/performance/my-evaluations` | Autoevaluaciones + como líder |
| `/performance/evaluations/[id]` | Detalle **read-only** desde snapshot |

Nav: Ciclos · Mis evaluaciones · Competencias · Escalas.

Query keys siempre con `companyId`. Invalidación acotada a participants del ciclo tras assign/bulk/exclude.

Evaluation Detail en 08B era read-only; en 08C el workspace editable vive en la misma ruta cuando `editable` (ver [performance-responses.md](./performance-responses.md)).

## Qué NO incluye 08B

Answers/ratings/submit/scores (08C), peer/360, goals/OKRs, calibration, feedback meetings, PDP, notifications, PDF, IA, workers.
