# ATS — Candidates, applications & pipeline

## Scope (Phase 04B)

This phase covers:

- `Candidate` (person)
- `Application` (candidate ↔ vacancy participation)
- `ApplicationStageHistory` (pipeline history)
- Kanban-oriented `GET /ats/vacancies/:vacancyId/pipeline`
- Controlled stage transitions
- Tenant-scoped filters/search
- Duplicate prevention

Not included: CV upload/parsing, AI, interviews, offer, contract, hiring, `Employee` creation, automatic `filledCount` / `Candidate.status = HIRED`.

## Candidate vs Application

| Entity | Meaning |
|--------|---------|
| **Candidate** | The person. One record per person per company. |
| **Application** | That person’s participation in **one** vacancy. |

A candidate may have many applications (different vacancies). Never create a new Candidate per vacancy.

```text
Candidate (1) ──< Application (N) >── (1) Vacancy
```

All entities belong to `Company`.

## Uniqueness

| Constraint | Purpose |
|------------|---------|
| `UNIQUE(companyId, email)` | No duplicate candidates by email inside a tenant. Email is **not** globally unique. |
| `UNIQUE(companyId, documentNumber)` | Avoid duplicate documents in tenant; multiple `NULL` allowed (PostgreSQL). |
| `UNIQUE(candidateId, vacancyId)` | One application per candidate per vacancy. |

Email is normalized: trim + lowercase.

## Creating applications

`POST /ats/applications` and `POST /ats/candidates/:candidateId/applications` share the same `ApplicationsService.create` logic.

Requirements:

1. `companyId` only from `TenantContext`
2. Candidate and Vacancy must belong to the tenant and not be soft-deleted
3. Vacancy must be `OPEN`
4. **PAUSED / CLOSED / CANCELLED** → reject new applications (documented: no new apps while PAUSED)

Initial state:

- `stage = PENDING_REVIEW`
- `status = ACTIVE`
- history row: `fromStage = null`, `toStage = PENDING_REVIEW`

## Pipeline stages

Ordered Kanban columns:

1. `PENDING_REVIEW`
2. `CONTACTED`
3. `INTERVIEW`
4. `OFFER`
5. `HIRED`
6. `REJECTED`
7. `WITHDRAWN`

Pipeline response shape (lightweight cards only):

```json
{
  "vacancy": { "id": "...", "title": "...", "status": "OPEN" },
  "columns": [
    {
      "stage": "PENDING_REVIEW",
      "count": 1,
      "applications": [
        {
          "applicationId": "...",
          "candidateId": "...",
          "candidateName": "...",
          "candidateEmail": "...",
          "stage": "PENDING_REVIEW",
          "lastStageChangedAt": "..."
        }
      ]
    }
  ]
}
```

## Transition matrix

No backwards moves and no jumps in this phase.

| From | Allowed to |
|------|------------|
| `PENDING_REVIEW` | `CONTACTED`, `REJECTED`, `WITHDRAWN` |
| `CONTACTED` | `INTERVIEW`, `REJECTED`, `WITHDRAWN` |
| `INTERVIEW` | `OFFER`, `REJECTED`, `WITHDRAWN` |
| `OFFER` | `HIRED`, `REJECTED`, `WITHDRAWN` |
| `HIRED` / `REJECTED` / `WITHDRAWN` | _(terminal — no moves)_ |

Every successful move appends `ApplicationStageHistory`.

## Terminal behavior

When stage becomes `HIRED`, `REJECTED`, or `WITHDRAWN`:

- `Application.status = CLOSED`

**Intentionally not done yet:**

- `Candidate.status` is **not** set to `HIRED`
- `Vacancy.filledCount` is **not** incremented
- No `Employee` is created

Hiring side effects belong to a later Offer/Contract/Hiring workflow so pipeline “HIRED” means “selected in process”, not “onboarded”.

## Concurrency

Stage moves run inside a transaction with `SELECT … FOR UPDATE` on the application row, plus conditional `updateMany` on the current stage.

- If two clients race to the **same** target stage, the loser sees the stage already applied and receives **409 Conflict**.
- Stage update + history are transactional; audit is written after a successful domain commit.

## Multi-tenancy

- DTOs never accept `companyId`
- All reads/writes filter by `TenantContext.companyId`
- Candidate, Vacancy, and Application must match the tenant
- Cross-tenant access returns 404 (not found), not leakage

## RBAC

| Permission | Purpose |
|------------|---------|
| `ats.candidate.read` | List/get candidates |
| `ats.candidate.manage` | Create/update candidates |
| `ats.application.read` | List/get applications, history, pipeline |
| `ats.application.manage` | Create applications, move stages |

Assignments:

- **CLIENT_ADMIN** / **RECRUITER**: all four
- **LEADER**: `ats.candidate.read`, `ats.application.read` only
- **PERFORMANCE_MANAGER** / **COLLABORATOR**: none of these new permissions

Existing vacancy permissions are unchanged.

## Audit

| Action | Metadata (minimal) |
|--------|--------------------|
| `CANDIDATE_CREATED` / `CANDIDATE_UPDATED` | `candidateId` |
| `APPLICATION_CREATED` | `applicationId`, `candidateId`, `vacancyId`, `toStage` |
| `APPLICATION_STAGE_CHANGED` | `applicationId`, `candidateId`, `vacancyId`, `fromStage`, `toStage` |

No full PII or full comments in metadata.

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| `POST` | `/ats/candidates` | manage |
| `GET` | `/ats/candidates` | read |
| `GET` | `/ats/candidates/:id` | read |
| `PATCH` | `/ats/candidates/:id` | manage |
| `POST` | `/ats/candidates/:candidateId/applications` | application.manage |
| `POST` | `/ats/applications` | manage |
| `GET` | `/ats/applications` | read |
| `GET` | `/ats/applications/:id` | read |
| `GET` | `/ats/applications/:id/history` | read |
| `POST` | `/ats/applications/:id/move` | manage |
| `GET` | `/ats/vacancies/:vacancyId/pipeline` | application.read |

`PATCH` candidate allows controlled `ACTIVE` / `INACTIVE`. Setting `HIRED` via PATCH is rejected until the hiring workflow exists.
