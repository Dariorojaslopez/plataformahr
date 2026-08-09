# Goals Progress / Check-ins (09B)

Seguimiento histórico de objetivos mediante **check-ins append-only**.
Dominio independiente de Performance. El progreso es **operacional**, no score final.

## Modelo `GoalCheckIn`

| Campo | Notas |
|-------|--------|
| `companyId` | Tenant (TenantContext) |
| `goalId` | Denormalizado (índices / consistencia); debe coincidir con KR |
| `keyResultId` | KR objetivo |
| `sequence` | Entero ≥ 1; `UNIQUE(keyResultId, sequence)` |
| `createdByUserId` | Autoridad primaria del actor |
| `createdByEmployeeId` | Opcional si el User tiene Employee |
| `numericValue` / `booleanValue` | XOR (CHECK SQL) |
| `comment` | ≤ 2000, trim → null si vacío |
| `evidenceReference` | Texto/URL ≤ 1000; **sin upload** |

**Append-only:** no hay `PATCH` ni `DELETE`. Un error se corrige con otro check-in.

## Sequence y latest

Al crear:

1. `SELECT … FROM goal_key_results … FOR UPDATE`
2. `max(sequence) + 1`
3. Insert
4. Reintento acotado ante `P2002`

**Latest** = mayor `sequence` (no solo `createdAt`).
Orden de historial API: `sequence DESC`, `id DESC`.

## Current value

Derivado del último check-in. Sin check-in:

- numérico → `startValue` (null tratado como `0` operacionalmente)
- BOOLEAN → no completado (`false` / 0 %)

No se persiste `currentValue` duplicado en el KR.

## Progress (operacional ≠ score)

Helpers puros: `calculateKeyResultProgress` / `calculateGoalProgress`.

| Métrica | Fórmula |
|---------|---------|
| INCREASE | `(current - start) / (target - start) * 100` clamp 0–100 |
| DECREASE | `(start - current) / (start - target) * 100` clamp 0–100 |
| start == target | current == target → 100; si no → 0 |
| BOOLEAN | false / sin check-in → 0; true → 100 |

Goal:

- todos `weight` null → promedio simple
- weights (validados en 09A) → promedio ponderado

Resultado 0–100 con 2 decimales. **Nunca** se llama `score` / `scorePercentage`.
No se persiste. No integra `PerformanceResult`.

## Writes

Solo si **Goal ACTIVE** y **GoalCycle ACTIVE**.
Además (09C): rechaza con **409** si existe `GoalCompletionRequest` PENDING
(“El objetivo está en revisión de cierre”).

Lock order compartido con completion: **Goal → KR**.

## Autorización

| Permiso | Uso |
|---------|-----|
| `goals.goal.read` | Lectura progress / historial / mine / team |
| `goals.progress.update` | POST check-in (resource-scoped) |

Escritura:

- `goals.goal.manage` + `goals.progress.update` → admin tenant-wide
- solo `goals.progress.update` → debe ser **GoalAssignment** (Employee del User)

Aplicabilidad (mine) ≠ responsabilidad (check-in).

| Rol seed | progress.update |
|----------|-----------------|
| CLIENT_ADMIN / PERFORMANCE_MANAGER | sí (+ manage) |
| COLLABORATOR | sí (solo assignment) |
| LEADER | **no** |
| RECRUITER | no |

## Team

`GET /goals/team` — reportes **DIRECT** del Employee del User.
Agrupado por employee: INDIVIDUAL asignados + AREA del report + COMPANY.
Leader **no** check-in por subordinado en 09B.
`GET /goals/:id` permite lectura si manage, mine, o reporte DIRECT aplicable.

## Endpoints

```
POST /goals/:goalId/key-results/:keyResultId/check-ins   (progress.update)
GET  /goals/:goalId/key-results/:keyResultId/check-ins   (goal.read, paginado)
GET  /goals/:goalId/progress                             (goal.read)
GET  /goals/mine                                         (enriquecido: progress, canCheckIn)
GET  /goals/team                                         (goal.read)
```

Historial: `page` / `limit` (default 20, max 100).

## Audit

`GOAL_CHECK_IN_CREATED` — metadata: `goalId`, `keyResultId`, `checkInId`, `sequence`.
**Sin** comment ni evidenceReference.

## Query strategy

Latest check-ins: una `findMany` ordenada por `sequence DESC` + first-per-KR en memoria
(evita N+1). Alternativa futura: `DISTINCT ON (keyResultId)`.

## UI

- `/my-goals`: progress bars + CTA “Registrar avance” si `canCheckIn`
- `/goals/:id`: sección Seguimiento
- `/goals/team`: Mi equipo (alfabético, sin ranking)
- Evidencia: texto; link solo si `safeHttpUrl`

## Límites 09B (fuera de alcance)

- Goal COMPLETED / cierre formal / score final / aprobación
- Integración Performance / rankings / 9-box / IA
- Upload de archivos / S3 / blobs
