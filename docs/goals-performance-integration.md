# Goals ↔ Performance integration (09D)

## Architecture

Performance can optionally blend **competency consolidation** (08D) with **Goals achievement** (09C) into a single historical `PerformanceResult`.

Two weight levels (never mixed in one step):

1. **Competencies:** `selfEvaluationWeight` / `managerEvaluationWeight` → `competencyScore`
2. **Composition:** `competencyResultWeight` / `goalsResultWeight` → `overallScore`

```
SELF/MANAGER evaluations
        ↓
  competencyScore
Goals GoalResults
        ↓
  goalsAchievement
competencyScore + goalsAchievement (weighted)
        ↓
  overallScore  (analytics / CSV authority)
```

## PerformanceCycle configuration

| Field | Semantics |
| --- | --- |
| `goalCycleId` | Optional FK to `GoalCycle` (same company). `null` = competency-only (08D). |
| `competencyResultWeight` | Weight of competencyScore in overall (required when linked). |
| `goalsResultWeight` | Weight of goalsAchievement in overall (required when linked). |

Rules:

- Editable only while cycle is `DRAFT`.
- When `goalCycleId` is set: both weights required, 0–100, sum = 100.
- When `goalCycleId` is null: both weights must be null.
- Cross-tenant GoalCycle → 404.
- GoalCycle may continue evolving; at **calculate** time only frozen `GoalResult` data is used.

## Legacy compatibility

| `composition` | Meaning |
| --- | --- |
| `COMPETENCY_ONLY` | Pre-09D / no Goals link. `overallScore` is the 08D competency consolidation. |
| `COMPETENCY_AND_GOALS` | Integrated result. `overallScore` blends competency + goals. |

Migration backfill: existing rows keep `COMPETENCY_ONLY` and set `competencyScore = overallScore`. No destructive recalculation.

## Applicable Goals semantics

For each participant employee, Goals enter from the linked `GoalCycle` via **GoalResult** only:

| Type | Inclusion |
| --- | --- |
| `INDIVIDUAL` | Employee is in `GoalResultApplicableEmployee` (assignments frozen at approval). |
| `AREA` | Employee is in `GoalResultApplicableEmployee` (area membership frozen at approval). |
| `COMPANY` | `GoalResult.appliesCompanyWide = true`. |

Not every Goal visible in `/goals/mine` automatically enters Performance — only GoalResults that match the above.

## Goal.weight semantics

- Inside a Goal (09C): KR weights drive achievement; `Goal.weight` does **not** affect internal Goal achievement.
- Across Goals (09D): `GoalResult.goalConfiguredWeight` (snapshot of `Goal.weight`) weights Goals into `goalsAchievement`.
  - All null → equal effective weights (sum 100).
  - All set → must sum to 100; no silent invention.
  - Mixed null/non-null → calculate rejected.

## GoalResult authority

- Only approved/completed `GoalResult` (09C).
- Never `progressPercentage`, never live check-ins.
- If `goalsResultWeight > 0` and an applicable Goal lacks GoalResult → 400.
- If `goalsResultWeight > 0` and zero applicable GoalResults → 400 (`No existen resultados de objetivos aplicables…`).
- If `goalsResultWeight = 0` → Goals do not block; overall equals competencyScore.

## Organizational snapshot strategy

At Goal completion approval:

- Snapshot goal title/type/area on `GoalResult`.
- Freeze audience in `GoalResultApplicableEmployee` (employee + area at approval).

Later `Employee.areaId` changes do **not** remove historical applicability for Performance calculate.

## PerformanceResultGoal snapshot

Relational rows (no FK to live Goal/GoalResult):

- source IDs, title, type, achievement, configured/effective weight, contribution, order

Answers historically: which Goals entered, achievements, weights, contributions — without reading live Goals.

## Calculate / transaction / concurrency

`POST /performance/cycles/:cycleId/participants/:id/result/calculate`

- Case A: no `goalCycleId` → 08D behavior (`COMPETENCY_ONLY`).
- Case B: linked GoalCycle → competency + goals (when weight > 0), single transaction, `PerformanceResultGoal` creates, then participant → `COMPLETED`.
- Failure anywhere → full rollback.
- `FOR UPDATE` + unique `participantId` + `P2002` → 409.

## Release / privacy

Unchanged lifecycle: `CALCULATED` → `RELEASED`.

Employee (`/my-results`) sees RELEASED only:

- overall, competency, goals composition, Goals breakdown (title/type/achievement/effectiveWeight)
- **Never** `managerScore`, manager responses/comments

## Analytics / CSV

- KPIs use `overallScore` (effective overall for both legacy and integrated).
- CSV adds: Resultado general, Competencias, Objetivos, Composición (keeps BOM, RFC4180, formula injection protection, 10k limit, Bearer + X-Company-Id).

## RBAC / audit

Reuses `performance.result.read|manage|release`. No new permissions.

Audit `PERFORMANCE_RESULT_CALCULATED` metadata includes `performanceResultId`, `participantId`, `goalCycleId`, `goalResultCount` — no comments/responses/check-ins.

## Limitations (out of scope)

No rankings, 9-box, calibration, 360, PDP, or AI.
