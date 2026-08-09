# Goals Completion / Final Achievement (09C)

Cierre formal de objetivos con resultado histórico inmutable.
**Independiente de Performance** — no modifica `PerformanceResult` ni scoring 08C–08E.

## Terminología

| Término | Fase | Significado |
|---------|------|-------------|
| `progressPercentage` | 09B | Seguimiento operacional dinámico |
| `achievementPercentage` | 09C | Cumplimiento formal congelado |

No usar `scorePercentage` para Goals.

## Modelos

### `GoalCompletionRequest`

Workflow: `PENDING` → `APPROVED` | `REJECTED`.

- Historial de intentos permitido
- **Solo una PENDING** por Goal (`UNIQUE` parcial SQL)
- `requestComment` opcional; `reviewComment` obligatorio al rechazar

### `GoalResult` + `GoalResultKeyResult`

Creados solo al aprobar. `UNIQUE(goalId)`.
Snapshot KR con valores finales, pesos y achievement.
`sourceKeyResultId` sin FK (trazabilidad).

## Workflow

1. Goal **ACTIVE**, Cycle **ACTIVE**, ≥1 KR
2. Cada KR con ≥1 check-in
3. Responsable / Admin / PM → `POST …/completion-requests`
4. PENDING **congela check-ins** (409)
5. Reviewer aprueba o rechaza
6. APPROVED → `GoalResult` + Goal **COMPLETED** (transaccional)
7. REJECTED → Goal sigue ACTIVE; check-ins y re-request permitidos

## Quién solicita

- Responsable en `GoalAssignment`
- CLIENT_ADMIN / PERFORMANCE_MANAGER (`goals.goal.manage` + `goals.completion.request`)
- Aplicabilidad `/mine` ≠ poder cerrar

## Quién revisa

| Tipo | Reviewer |
|------|----------|
| INDIVIDUAL | DIRECT manager de **todos** los assignments, o Admin/PM |
| AREA / COMPANY | Solo Admin / PM |

**Sin self-approval:** `requestedByUserId != reviewerUserId`.

## Achievement

Misma base matemática que progress 09B, helpers `calculateKeyResultAchievement` / `calculateGoalAchievement`.
Clamp 0–100 (sin overachievement). Final value = latest check-in al aprobar.

- Weighted: `configuredWeight` = `effectiveWeight`
- Unweighted: `effectiveWeight` = partes iguales que suman 100
- `Goal.weight` se snapshottea (`goalConfiguredWeight`) pero **no** entra en achievement del Goal

## Lock order

1. `goals` `FOR UPDATE`
2. (check-in) pending check → `goal_key_results` `FOR UPDATE`
3. (approve) `goal_completion_requests` `FOR UPDATE`

## Endpoints

```
POST /goals/:id/completion-requests
GET  /goals/:id/completion-requests
GET  /goals/completion-requests          (bandeja review)
POST /goals/completion-requests/:id/approve
POST /goals/completion-requests/:id/reject
GET  /goals/:id/result
```

## Mine / Team

Incluyen `ACTIVE` + `COMPLETED` (no DRAFT/CANCELLED).
COMPLETED muestra `achievementPercentage`; sin CTA check-in.

## Cycle close (actualizado)

Close exige que todos los Goals del ciclo estén `COMPLETED` o `CANCELLED`
(bloquea ACTIVE y DRAFT).
Cancel de ciclo bloquea si hay CompletionRequest PENDING.

## RBAC

| Permiso | CLIENT_ADMIN / PM | LEADER | COLLABORATOR |
|---------|-------------------|--------|--------------|
| `goals.completion.request` | ✓ | — | ✓ (resource) |
| `goals.completion.review` | ✓ | ✓ (DIRECT individual) | — |

## Privacidad

Responsables / Admin / PM / reviewer: comentarios visibles.
Viewers AREA/COMPANY no responsables: achievement global, **sin** review/request comments.

## Límites 09C

- Sin override manual de achievement
- Sin ranking / leaderboard
- Sin integración Performance (09D)
- Sin release separado tipo PerformanceResult
