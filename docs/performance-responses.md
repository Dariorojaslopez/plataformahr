# Performance Responses (08C)

Respuestas, ratings, draft parcial, submit e **score individual** por evaluación.
Ver también: [performance-evaluations.md](./performance-evaluations.md) (08B), [performance-core.md](./performance-core.md) (08A).

Consolidación SELF+MANAGER y resultado final del Employee: ver [performance-results.md](./performance-results.md) (08D).

## Response model

`PerformanceEvaluationResponse`:

| Campo | Rol |
|-------|-----|
| `evaluationId` | Evaluación |
| `evaluationCompetencyId` | Snapshot competency (`PerformanceEvaluationCompetency`) |
| `selectedScaleLevelId` | Snapshot level (`PerformanceEvaluationScaleLevel`) |
| `ratingValue` | Copia de `level.value` al guardar |
| `comment?` | Texto libre, max 2000, trim → vacío = null |

`UNIQUE(evaluationId, evaluationCompetencyId)`.

El cliente envía `scaleLevelId` del snapshot, **nunca** un rating numérico arbitrario ni IDs del catálogo global.

## Save semantics

`PUT /performance/evaluations/:evaluationId/competencies/:competencyId/response`

- Upsert inmediato (draft parcial = cada PUT).
- Solo `evaluatorEmployeeId` + permiso `performance.evaluation.respond`.
- **Manage ≠ impersonate:** CLIENT_ADMIN / PERFORMANCE_MANAGER no responden por otro.
- User sin Employee → 403.
- Ciclo `ACTIVE`, participant `ACTIVE`, evaluation ≠ `SUBMITTED`.
- Primera respuesta válida: `PENDING → IN_PROGRESS`, `startedAt` una sola vez.

## Submit

`POST /performance/evaluations/:id/submit`

TX + `FOR UPDATE` sobre la evaluation:

1. Validar actor evaluator + respond
2. Cycle ACTIVE, participant ACTIVE
3. Required con respuesta
4. ≥ 1 respuesta total
5. Calcular `scorePercentage`
6. `SUBMITTED` + `submittedAt`
7. Audit

Segundo submit → 409. Save tras submit → 409.

## Required / optional

- `required=true` sin respuesta → 400 `{ missingRequired: [{ id, name }] }`
- `required=false` puede omitirse; **no** participa en score
- Todas optional pero cero respuestas → 400

## Score algorithm

Persistido solo:

`PerformanceEvaluation.scorePercentage` `Decimal(5,2)` (0.00–100.00).

Autoridad al submit. SELF y MANAGER independientes.

### Normalización por escala (snapshot)

```
normalized = (ratingValue - minValue) / (maxValue - minValue)   // 0–1
```

`maxValue > minValue` obligatorio (si no → submit falla).

### Unweighted

Promedio de `normalized * 100` entre competencias **respondidas**.

### Weighted

Re-normalizar weights entre respondidas:

```
Σ (normalized_i * weight_i) / Σ weight_respondidas * 100
```

Optional omitida **no** cuenta como cero.

Rounding: 2 decimales half-up.

Breakdown por competencia se **recalcula** en GET (histórico) cuando SUBMITTED; el porcentaje final persistido manda.

## Privacy

| Actor | SELF | MANAGER |
|-------|------|---------|
| Subject | lee/responde SELF | **no** lee MANAGER |
| Evaluator | — | lee/responde MANAGER |
| manage | lee tenant-wide | lee; **no** responde |

## Cycle / excluded

| Estado | Save | Submit | Read |
|--------|------|--------|------|
| Cycle ACTIVE | sí* | sí* | sí |
| Cycle CLOSED/CANCELLED | no | no | sí (histórico) |
| Participant EXCLUDED | no | no | sí |
| Evaluation SUBMITTED | no | 409 | sí |

\*Si actor es evaluator.

Participant **no** pasa a COMPLETED al submit; eso ocurre al calcular el resultado consolidado en [08D](./performance-results.md).

## Concurrency

- Response: UNIQUE + upsert; lock evaluation en TX.
- Submit vs save: ambos lockean evaluation; post-SUBMITTED no muta.

## Audit

| Action | Metadata |
|--------|----------|
| `PERFORMANCE_EVALUATION_RESPONSE_SAVED` | evaluationId, evaluationCompetencyId, selectedScaleLevelId, type |
| `PERFORMANCE_EVALUATION_SUBMITTED` | evaluationId, type, scorePercentage |

Sin comment ni textos de rating.

## Endpoints

```
PUT  /performance/evaluations/:evaluationId/competencies/:competencyId/response
POST /performance/evaluations/:id/submit
GET  /performance/evaluations/:id   # incluye response + canRespond/editable + score
GET  /performance/evaluations/mine  # progreso counts + scorePercentage
```

## Frontend UX

- Workspace editable si `editable === true`
- Radios desde snapshot levels (no hardcode 1–5)
- Guardar por competencia + dirty state
- Progreso desde respuestas persistidas
- Submit con confirmación
- SUBMITTED read-only + “Resultado de esta evaluación”
- Mine CTAs: Comenzar / Continuar / Ver resultado

## Qué NO incluye 08C

Overall participant score y consolidación SELF/MANAGER (ver [performance-results.md](./performance-results.md) 08D), calibration, peer/360, goals/OKRs, notifications, PDF, IA, workers.
