# Goals / OKRs Core (09A)

Núcleo de periodos, objetivos, Key Results y asignaciones.
**Dominio independiente de Performance** — sin integración con `PerformanceResult` en 09A.

## Modelos

| Modelo | Rol |
|--------|-----|
| `GoalCycle` | Periodo de objetivos (lifecycle propio) |
| `Goal` | Objetivo INDIVIDUAL / AREA / COMPANY |
| `GoalAssignment` | Responsabilidad/asignación explícita a Employee |
| `GoalKeyResult` | Target medible |
| `GoalCheckIn` | Avance histórico append-only (09B) — ver [goals-progress.md](./goals-progress.md) |
| `GoalCompletionRequest` / `GoalResult` | Cierre formal + achievement inmutable (09C) — ver [goals-completion.md](./goals-completion.md) |

No existe modelo `Team` en la organización → **no hay GoalType TEAM**.

## Enums

- `GoalCycleStatus`: DRAFT · ACTIVE · CLOSED · CANCELLED
- `GoalType`: INDIVIDUAL · AREA · COMPANY
- `GoalStatus`: DRAFT · ACTIVE · **COMPLETED** (reservado 09C) · CANCELLED
- `GoalMetricType`: NUMBER · PERCENTAGE · CURRENCY · BOOLEAN
- `GoalMetricDirection`: INCREASE · DECREASE

## GoalCycle

- `startDate < endDate` (CHECK SQL)
- Transiciones: DRAFT→ACTIVE|CANCELLED; ACTIVE→CLOSED|CANCELLED
- Activar ciclo **no** activa Goals DRAFT
- Close rechaza si existen Goals **ACTIVE**

## Goal

### Tipos

| Tipo | areaId | Assignments |
|------|--------|-------------|
| INDIVIDUAL | null | ≥1 obligatorio al activar |
| AREA | obligatorio (mismo tenant) | opcionales (responsables) |
| COMPANY | null | opcionales |

AREA/COMPANY **no** materializan assignments a todos los empleados.
`/goals/mine` resuelve aplicabilidad dinámicamente.

### Lifecycle 09A

- DRAFT → ACTIVE | CANCELLED
- ACTIVE → CANCELLED | COMPLETED (COMPLETED solo vía approval 09C)
- No POST directo ACTIVE→COMPLETED

ACTIVE: estructura congelada (type, area, KR, weights, assignments).

## GoalAssignment

Representa **responsable/asignación explícita** a Employee.
`UNIQUE(goalId, employeeId)`.

## GoalKeyResult

Targets; el valor actual y progreso operacional se derivan de `GoalCheckIn` (09B).

| metricType | Campos |
|------------|--------|
| NUMBER | direction, start?, target, unit? |
| PERCENTAGE | direction, start?, target (sin forzar 0–100) |
| CURRENCY | direction, start?, target, currencyCode ISO-3 |
| BOOLEAN | targetBoolean; sin direction/números |

### Pesos KR

- Todos null → OK
- Alguno con weight → todos con weight y suma **100**
- Validado al **activar** Goal

`Goal.weight` se almacena; no calcula score Performance.

## Activación Goal

`POST /goals/:id/activate` requiere:

- Cycle ACTIVE
- Goal DRAFT
- ≥1 KR + pesos válidos
- reglas por tipo (assignment / areaId)

## Endpoints (resumen)

```
GET/POST     /goals/cycles
GET/PATCH    /goals/cycles/:id
POST         /goals/cycles/:id/activate|close|cancel

GET          /goals/mine          (goal.read)
GET/POST     /goals               (list = goal.manage)
GET/PATCH    /goals/:id           (get: manage o mine)
POST         /goals/:id/activate|cancel
CRUD KR      /goals/:id/key-results...
Assignments  /goals/:id/assignments...
```

## /goals/mine

Incluye Goals **ACTIVE** y **COMPLETED**:

1. INDIVIDUAL asignados al Employee del User
2. AREA con `areaId == Employee.areaId`
3. COMPANY

Oculta DRAFT y CANCELLED.
Sin Employee vinculado → `{ items: [] }`.

## RBAC

| Permission | CLIENT_ADMIN | PERFORMANCE_MANAGER | LEADER / COLLABORATOR | RECRUITER |
|------------|--------------|---------------------|-----------------------|-----------|
| `goals.cycle.read` | ✓ | ✓ | ✓ | — |
| `goals.cycle.manage` | ✓ | ✓ | — | — |
| `goals.goal.read` | ✓ | ✓ | ✓ (mine) | — |
| `goals.goal.manage` | ✓ | ✓ | — | — |
| `goals.goal.assign` | ✓ | ✓ | — | — |

Listado admin tenant-wide exige `goal.manage` (no filtrar accidentalmente por `read`).

## Multi-tenancy

`companyId` solo `TenantContext`. Cross-tenant → 404.

## Audit

`GOAL_CYCLE_*`, `GOAL_*`, `GOAL_KEY_RESULT_*`, `GOAL_ASSIGNMENT_*`.

## Frontend

- Nav **Objetivos**: Periodos, Objetivos organizacionales, Mis objetivos
- `/goals/cycles`, `/goals/cycles/[id]`, `/goals`, `/goals/[id]`, `/my-goals`
- Keys: `["goals", companyId, ...]`
- **Objetivos organizacionales** (`/goals`): listado COMPANY. Quien tiene `CLIENT_ADMIN` o `PERFORMANCE_MANAGER` puede **crear** (periodo, método de evaluación = métrica del KR, meta). La carga de resultados es el check-in del detalle con el periodo y el objetivo ACTIVE.
- Colaboradores ven el listado y el detalle en consulta (sin editar estructura).
- My Goals: ACTIVE/COMPLETED aplicables + aviso de avances

## Qué NO hace 09A

- Progress / check-ins / evidence
- Scoring / achievement
- Aprobación del líder
- Vista “objetivos de mi equipo”
- Integración Performance (`goalScore`, pesos en PerformanceCycle, etc.)
- Charts

## Siguiente (09B)

Check-ins históricos y progreso sobre Key Results.
