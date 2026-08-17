# ATS — Vacancy requests & vacancies

## Scope (Phase 04A)

This phase covers:

- `VacancyRequest` (DRAFT → approval workflow → APPROVED/REJECTED)
- `VacancyApproval` snapshot steps
- Per-company `VacancyApprovalWorkflow` configuration
- Automatic `Vacancy` creation on full approval
- Basic vacancy status management

Not included: candidates, applications, kanban, interviews, AI, hiring.

## Concepts

### VacancyRequest

A request to open hiring capacity for an existing or new position.

Types:

- `EXISTING_POSITION` — references `existingPositionId`
- `NEW_POSITION` — requires `requestedPositionName` + `requestedAreaId` (+ optional job level)

### Approval workflow

Configuration (`VacancyApprovalWorkflow` + `VacancyApprovalWorkflowStep`) is per company.

A snapshot (`VacancyApproval` rows) is created **only on submit** (`DRAFT` → `PENDING_APPROVAL`). Changing the company workflow later does **not** rewrite in-flight or historical requests.

Supported approver types (deterministic with the current domain):

| Type | Resolution |
|------|------------|
| `MANAGER_OF_REQUESTER` | `requestedByEmployeeId` → `EmployeeReportingLine` `DIRECT` → manager `Employee`. The manager must have `userId` and an **active** membership in the company. Otherwise submit fails with an explicit 400. |
| `SPECIFIC_EMPLOYEE` | Employee in the same company, with `userId` and active membership. Cross-tenant IDs return `Employee not found`. |
| `ROLE` | Existing **COMPANY** role code (e.g. `CLIENT_ADMIN`). Anyone with that membership role and `ats.vacancy.approve` can decide the current step. |

There is no separate “HR owner” entity. The previous HR step used role `CLIENT_ADMIN`; configurable ROLE steps can express that without inventing a new RRHH source.

Not implemented: permission expressions, parallel steps, SLA, delegation, a generic BPM engine.

### Legacy fallback

Companies **without** a workflow row, or with `enabled = false`, keep the previous hardcoded path:

1. `DIRECT_MANAGER`
2. `HR` (`requiredRoleCode = CLIENT_ADMIN`)
3. `GENERAL_MANAGER` only if `generalManagerApprovalRequired` on that request

Submit still requires a DIRECT manager in the legacy path. `generalManagerApprovalRequired` is ignored once a configurable workflow is enabled.

### Sequential decisions

Only the first `PENDING` step by `sequence` can be approved or rejected.

- Approve a step → the next `PENDING` step becomes current.
- Approve the last step → request `APPROVED` and a `Vacancy` is created.
- Reject a step → request `REJECTED`, comment persisted on the step, later steps `SKIPPED`.

### Authorization

`ats.vacancy.approve` is required **and** the caller must be the concrete actor of the current step (assigned employee, or membership role). There is no silent admin override. `CLIENT_ADMIN` cannot approve a manager/specific-employee step unless they are that employee.

### Vacancy

Created automatically when the request becomes fully `APPROVED`.

- `vacancyRequestId` is unique (prevents duplicate vacancies)
- Manual `POST /ats/vacancies` is intentionally not available

## Position.headcount vs Vacancy.headcount

| Field | Meaning |
|-------|---------|
| `Position.headcount` | Approved organizational capacity for that job |
| `Vacancy.headcount` | Openings in that specific vacancy |

On approval:

- **Existing position:** `Position.headcount += requestedHeadcount` once, then create vacancy with the same requested headcount
- **New position:** create `Position` with `headcount = requestedHeadcount`, then create vacancy with the same value

Do not increment twice.

## Requested-by policy

- `CLIENT_ADMIN` / `RECRUITER` may create requests on behalf of another employee in the tenant
- Other roles may only request for their own linked `Employee`
- If no `requestedByEmployeeId` is provided, the API uses the caller's linked employee when present

## Permissions

| Permission | Purpose |
|------------|---------|
| `ats.vacancy.read` | List/get requests, vacancies, and the approval workflow |
| `ats.vacancy.request` | Create/update/submit drafts |
| `ats.vacancy.approve` | Approve/reject (plus step eligibility) |
| `ats.vacancy.manage` | Patch vacancy description/status; **update** the approval workflow |

`ats.vacancy.approve` alone is not enough: employee-bound steps must match the linked employee; role steps require the snapshot `requiredRoleCode`.

## Notifications

There is no email/queue notification system in this codebase. Future work can hook after submit (notify first approver) and after a step is approved (notify the next pending actor). Do not add a mail engine here.

## Concurrency / idempotency

- Submit uses conditional `updateMany` on `status = DRAFT`
- Step decisions use conditional `updateMany` on `status = PENDING`
- Finalization uses conditional transition to `APPROVED`
- Unique `vacancyRequestId` on `Vacancy` blocks duplicate vacancy creation
- Unique `(vacancyRequestId, sequence)` on `VacancyApproval` (step type may repeat)

## Manual SQL

Migration `ats_vacancy_core_checks` adds CHECKs for:

- `requestedHeadcount >= 1`
- `Vacancy.headcount >= 1`
- `filledCount >= 0` and `filledCount <= headcount`
- type/field coherence for EXISTING vs NEW
- approval `sequence >= 1`

Migration `vacancy_approval_workflows` is additive: new workflow tables, `label` on snapshots, unique `(vacancyRequestId, sequence)`, and CHECKs on workflow step fields. Existing approval rows are not rewritten.

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH | `/ats/vacancy-requests` | read / request |
| GET | `/ats/vacancy-requests?pendingMyApproval=true` | read (filtered to current actor) |
| POST | `/ats/vacancy-requests/:id/submit` | request |
| POST | `/ats/vacancy-requests/:id/approve\|reject` | approve |
| GET | `/ats/vacancy-approval-workflow` | read |
| PUT | `/ats/vacancy-approval-workflow` | manage |
| GET/PATCH | `/ats/vacancies` | read / manage |
| POST | `/ats/vacancies/:id/publish` | manage |
| POST | `/ats/vacancies/:id/unpublish` | manage |
| GET | `/public/jobs/:publicId` | Public |
| POST | `/public/jobs/:publicId/apply` | Public (rate limited) |

Only `/ats/...` routes require JWT + validated `X-Company-Id`. Public job
routes derive the company exclusively from the vacancy `publicId` and reject
unknown body fields such as `companyId`.

## Public vacancy publication

Approval and publication are separate. A `Vacancy` is still created only after
its `VacancyRequest` is fully approved. An OPEN vacancy becomes public only
after the explicit publish action sets `publishedAt`; its random `publicId` is
created once and remains stable across unpublish/republish cycles. PAUSED,
CLOSED, CANCELLED, deleted, inactive-company, and unpublished vacancies return
the same public not-available response.

Public apply reuses Candidate by `(companyId, email)`, creates Application and
initial history transactionally, and relies on the existing
`(candidateId, vacancyId)` unique key for concurrent duplicate protection.
Unpublishing never removes ATS history. CAPTCHA is a possible future anti-spam
layer; this phase uses strict DTO validation and endpoint throttling.
