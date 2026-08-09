# Performance Analytics (08E)

Analítica administrativa y exportación CSV sobre datos **persistidos**.
Ver: [performance-core.md](./performance-core.md) (08A), [performance-evaluations.md](./performance-evaluations.md) (08B), [performance-responses.md](./performance-responses.md) (08C), [performance-results.md](./performance-results.md) (08D).

## Principio

08E es **READ/REPORTING**. No recalcula evaluaciones ni consolida resultados.

Autoridades:

| Métrica | Fuente |
|---------|--------|
| Scores individuales | `PerformanceEvaluation.scorePercentage` (08C) |
| Overall / status resultado | `PerformanceResult` (08D) |
| Avance de participantes | `PerformanceCycleParticipant.status` |

## Dos conceptos

### A. Process analytics

Avance operacional: participants, SELF/MANAGER status, calculated/released.

### B. Result analytics

Estadísticas sobre `overallScore` de resultados consolidados.

No mezclar denominadores (p. ej. completion ≠ submission ≠ release).

## Permissions

| Permission | CLIENT_ADMIN | PERFORMANCE_MANAGER | LEADER / COLLABORATOR / RECRUITER |
|------------|--------------|---------------------|-----------------------------------|
| `performance.analytics.read` | ✓ | ✓ | — |

Boundary explícito (no reutiliza `result.read` para dashboard/CSV).

## Endpoint analytics

`GET /performance/cycles/:cycleId/analytics`

Tenant: `TenantContext.companyId`. Ciclo inexistente / otro tenant → **404**.

Respuesta (conceptualmente):

- `cycle`
- `participants` (totales, elegibles, completionRate)
- `evaluations.self` / `evaluations.manager`
- `results` (calculated/released/average/min/max)
- `distribution`
- `byArea` / `byPosition` / `byBusinessUnit`

Estados de ciclo: DRAFT/ACTIVE/CLOSED/CANCELLED — analytics es read-only (útil histórico).

## Participant metrics

| Campo | Semántica |
|-------|-----------|
| `totalParticipants` | Todos los records (ACTIVE+COMPLETED+EXCLUDED) |
| `eligibleParticipants` | ACTIVE + COMPLETED |
| `completionRate` | COMPLETED / eligible × 100 (EXCLUDED fuera del denominador) |
| Denominador 0 | `0` |

## Evaluation process metrics

SELF y MANAGER separados. Cada tipo:

- `total` = pending + inProgress + submitted **de ese tipo**
- `submittedRate` = submitted / total (0 si total 0)

MANAGER `total` puede ser menor que SELF (empleados sin DIRECT manager al materializar).

## Results process metrics

- `calculatedResults` + `releasedResults` = `totalResults` (sin doble conteo)
- `releasedRate` = RELEASED / totalResults

## Score analytics population (admin)

Incluye **CALCULATED + RELEASED**.

> Las estadísticas administrativas incluyen resultados calculados, aunque aún no hayan sido publicados al colaborador.

Employee (`mine`) sigue viendo solo RELEASED (08D).

## Average / min / max

Sobre `PerformanceResult.overallScore` (CALCULATED+RELEASED), 2 decimales.
Sin resultados → `null` (no 0).

No se expone quién tiene min/max (sin ranking).

## Distribution

Buckets estadísticos neutrales (sin Bueno/Malo):

| Intervalo | Label UX |
|-----------|----------|
| [0, 20) | 0–19.99 |
| [20, 40) | 20–39.99 |
| [40, 60) | 40–59.99 |
| [60, 80) | 60–79.99 |
| [80, 100] | 80–100 (incluye 100) |

Cada bucket: `key`, `label`, `from`, `to`, `count`, `percentage`.

## Organizational snapshots

Al **calculate** (08D TX), se copian desde Employee actual:

- `areaIdSnapshot` / `areaNameSnapshot`
- `positionIdSnapshot` / `positionNameSnapshot`
- `businessUnitIdSnapshot` / `businessUnitNameSnapshot`

IDs **sin FK** (source snapshot). Nombre = autoridad de display histórica.

Legacy rows (pre-08E) pueden quedar null → analytics agrupa como:

- «Sin área» / «Sin cargo» / «Sin unidad de negocio»

Si el empleado cambia de área después del calculate, el breakdown histórico **no se mueve**.

Breakdown solo agregados (sin lista de empleados).

**Deuda:** para analytics anónimos futuros, considerar *minimum cohort size*.

## Report / filters

`GET /performance/results` (admin, `result.read`) admite:

- `cycleId`, `status`, `areaId`, `positionId`, `businessUnitId`, `search`, `page`, `limit`

Filtros org → **snapshots**.
`search` → name/email **actual** del Employee (localizador).

## CSV export

`GET /performance/results/export` — permiso `performance.analytics.read`.

- UTF-8 con BOM, `text/csv; charset=utf-8`
- Content-Disposition attachment (`resultados-desempeno-<ciclo>-YYYY-MM-DD.csv`)
- Mismos filtros que el listado
- Límite **10 000** filas → 400 si se excede
- Escaping RFC 4180
- Formula injection: celdas que empiezan con `= + - @` → prefijo `'`
- Sin comments / responses / tokens
- Tenant solo vía `TenantContext` (sin companyId en query)

Columnas (ES): Colaborador, Correo, Ciclo, Área, Cargo, Unidad de negocio, Autoevaluación, Evaluación del líder, Resultado, Estado, Fecha de cálculo, Fecha de publicación.

## Frontend

- Tab **Resumen** en `/performance/cycles/[id]`
- KPI cards, avance SELF/MANAGER, distribución (barras CSS accesibles), breakdown por área/cargo/BU
- `/performance/results`: filtros + columnas snapshot + Exportar CSV (fetch autenticado → blob)
- Query keys: `["performance", companyId, "analytics", cycleId]`
- Invalidación analytics tras assign/bulk/exclude/calculate/release

## Privacy

- Dashboard/CSV: CLIENT_ADMIN / PERFORMANCE_MANAGER
- LEADER / COLLABORATOR / RECRUITER: sin analytics tenant-wide
- CSV admin puede incluir `managerScore`; no responses/comments
- Employee UI no consume analytics

## Query / indexes

Agregaciones con `groupBy` / counts paralelos. Índices 08E:

- `(companyId, cycleId)`, `(cycleId, status)`
- `areaIdSnapshot`, `positionIdSnapshot`, `businessUnitIdSnapshot`

## Qué NO incluye 08E

Rankings, top/bottom performers, labels cualitativos, 9-box, goals/OKRs, 360, calibration, PDP, IA, PDF/XLSX, workers, Redis, materialized views, minimum cohort suppression.

## Smoke manual sugerido

1. Ciclo con COMPLETED CALCULATED 80 + RELEASED 90 + ACTIVE + EXCLUDED → promedio admin 85.
2. Mover empleado de área tras calculate → breakdown sigue en área histórica.
3. Export CSV filtrado: acentos, headers ES, sin comments, fórmulas neutralizadas.
4. LEADER analytics 403; PERFORMANCE_MANAGER 200; employee mine solo RELEASED.
