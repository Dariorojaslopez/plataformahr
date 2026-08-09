# Performance Results (08D)

Consolidación histórica SELF/MANAGER, participant COMPLETED y release controlado.
Ver: [performance-core.md](./performance-core.md) (08A), [performance-evaluations.md](./performance-evaluations.md) (08B), [performance-responses.md](./performance-responses.md) (08C).

## Configured evaluator weights

`PerformanceCycle`:

| Campo | Default (nuevos / migración) |
|-------|------------------------------|
| `selfEvaluationWeight` | 30.00 |
| `managerEvaluationWeight` | 70.00 |

**No** están hardcoded en la lógica de consolidación: siempre se leen del ciclo.

- Editables solo en **DRAFT**.
- Al activar: ambos ≥ 0, ≤ 100, suma **exactamente 100**.
- ACTIVE/CLOSED/CANCELLED: immutable.

Migración: defaults 30/70 en columnas (ciclos previos sin resultados 08D reciben defaults; no hay resultados históricos previos que reescribir).

## Result model

`PerformanceResult` (histórico, 1 por participant):

- `selfScore?`, `managerScore?`, `overallScore`
- `configuredSelfWeight`, `configuredManagerWeight`
- `effectiveSelfWeight`, `effectiveManagerWeight`
- `status`: CALCULATED | RELEASED
- `calculatedAt`, `releasedAt?`, `releasedByUserId?`
- Org snapshots (08E, al calculate): `area*Snapshot`, `position*Snapshot`, `businessUnit*Snapshot` (IDs sin FK)

`UNIQUE(participantId)`.

No depende del catálogo ni de reporting lines actuales.
Analytics/reporting histórico usa los snapshots (ver [performance-analytics.md](./performance-analytics.md)).

## Consolidation algorithm

Helper puro `calculatePerformanceResult` en `apps/api/src/performance/result-consolidation.ts`:

1. Toma evaluations **existentes** del participant.
2. Cada existente debe estar SUBMITTED con `scorePercentage` (autoridad 08C).
3. Tipos inexistentes (ej. sin MANAGER) → se omiten y se **re-normalizan** pesos (SELF-only → effectiveSelfWeight 100 / effectiveManagerWeight 0).
4. Tipos existentes con peso configurado 0 → igual deben estar SUBMITTED.
5. overall = Σ (score × effectiveWeight) / 100, redondeo 2 decimales half-up.

### Existencia vs incompleto

| Situación | ¿Consolida? |
|-----------|-------------|
| MANAGER no existe (NO_DIRECT_MANAGER en 08B) | Sí (SELF effective 100%) |
| MANAGER existe PENDING/IN_PROGRESS | **No** (400) |

### Ejemplos

- SELF 82.50 + MANAGER 76.25 @ 30/70 → **78.13** (`0.3×82.50 + 0.7×76.25`)
- Solo SELF 82.50 @ 30/70 → effective 100/0 → **82.50**
- SELF 0 / MANAGER 100, ambos SUBMITTED → overall = manager score

## Result statuses

| Status | Semántica |
|--------|-----------|
| `CALCULATED` | Consolidado; no visible al employee en mine |
| `RELEASED` | Publicado; employee ve overall/selfScore (sin managerScore) |

## Calculate

`POST /performance/cycles/:cycleId/participants/:participantId/result/calculate`

- Permiso: `performance.result.manage`
- Cycle ACTIVE, participant ACTIVE
- TX + `FOR UPDATE` participant → create result (+ org snapshot 08E) → participant ACTIVE→**COMPLETED**
- Segundo calculate / race → 409
- La consolidación (pesos/overall) **no** cambia en 08E; solo se amplía persistencia de snapshot org.

## Release

`POST .../result/release`

- Permiso: `performance.result.release`
- CALCULATED → RELEASED
- Cycle ACTIVE o CLOSED (no CANCELLED)
- Participant COMPLETED
- Segundo release → 409

**RELEASED ≠ abrir Evaluation MANAGER.** Privacidad 08C intacta: el employee **nunca** ve `managerScore`, ni comentarios/ratings de la evaluación MANAGER.

## Employee visibility

| Endpoint | Quién | Qué ve |
|----------|-------|--------|
| `GET /performance/results/mine` | Employee | Solo RELEASED propios |
| `GET /performance/results/:id` | Employee own+RELEASED | overall, selfScore, `managerIncluded`, pesos efectivos — **sin clave managerScore** |
| Admin list/detail | result.read | SELF + MANAGER + overall + pesos |

Unreleased propio → 404 (no filtrar existencia).

## Cycle close

Close rechaza si existen participants **ACTIVE**.
Requiere todos COMPLETED o EXCLUDED.

Cancel no crea/libera resultados.

## Endpoints

```
GET  /performance/results
GET  /performance/results/export   (08E, analytics.read)
GET  /performance/results/mine
GET  /performance/results/:id
POST /performance/cycles/:cycleId/participants/:participantId/result/calculate
POST /performance/cycles/:cycleId/participants/:participantId/result/release
GET  /performance/cycles/:cycleId/analytics   (08E, analytics.read)
```

(Pesos de evaluador en ciclo: create/PATCH `/performance/cycles` con `selfEvaluationWeight` / `managerEvaluationWeight`.)

Listado admin admite filtros snapshot: `areaId`, `positionId`, `businessUnitId` (además de cycle/status/search).

## Permissions

| Permission | CLIENT_ADMIN | PERFORMANCE_MANAGER | LEADER / COLLABORATOR / RECRUITER |
|------------|--------------|---------------------|-----------------------------------|
| `performance.result.read` | ✓ | ✓ | — |
| `performance.result.manage` | ✓ | ✓ | — |
| `performance.result.release` | ✓ | ✓ | — |
| `performance.analytics.read` | ✓ | ✓ | — |

Employee usa resource auth en mine/detail, no lectura tenant-wide.

## Audit

`PERFORMANCE_RESULT_CALCULATED`, `PERFORMANCE_RESULT_RELEASED` — metadata mínima (IDs, overallScore opcional).

## Frontend routes

- Ciclo DRAFT: “Ponderación de evaluadores”
- Participants: Calcular / Publicar
- `/performance/results` (+ `/performance/results/[id]` admin)
- `/performance/my-results` (+ `/performance/my-results/[id]` employee)

## Qué NO incluye 08D

Rankings, 9-box, goals/OKRs, 360, calibration, PDP, IA, notifications, workers, recalculate tras release, peer evaluators.

Dashboards / CSV / breakdown organizacional → **08E** ([performance-analytics.md](./performance-analytics.md)).
