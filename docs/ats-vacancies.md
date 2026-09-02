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
| `POSITION` | Cargo (`positionId`) → colaboradores ACTIVE en ese cargo. Si hay más de uno, hay que elegir `specificEmployeeId`. Si hay uno, se usa ese. No exige usuario de acceso para guardar el nivel; para aprobar o evaluar sí hace falta que ese colaborador tenga usuario. |
| `MANAGER_OF_REQUESTER` | `requestedByEmployeeId` → `EmployeeReportingLine` `DIRECT` → manager `Employee`. The manager must have `userId` and an **active** membership in the company. Otherwise submit fails with an explicit 400. |
| `SPECIFIC_EMPLOYEE` | Employee in the same company, with `userId` and active membership. Cross-tenant IDs return `Employee not found`. |
| `ROLE` | Existing **COMPANY** role code (e.g. `CLIENT_ADMIN`). Anyone with that membership role and `ats.vacancy.approve` can decide the current step. |

The settings UI only creates `POSITION` steps (Niveles de aprobación por defecto). The other types remain valid for existing workflows and tests.

### Per-request approval plan

On create, enabled global workflow steps are copied onto the request as `VacancyRequestApprovalPlanStep` with `origin = DEFAULT`. Extra levels from the create/edit form are stored as `CUSTOM`. DEFAULT rows stay frozen: they are not rewritten if the company workflow later changes, and the form cannot edit or delete them. CUSTOM rows can be replaced while the request is `DRAFT`.

Submit uses that frozen plan when it has at least one step. If the plan is empty (workflow disabled and no extras), submit uses `buildSnapshot` — the legacy path, including `generalManagerApprovalRequired` for API/e2e compatibility.

The create form (admin `/ats/vacancy-requests` and leader HOME) does **not** show the “Requiere aprobación de Gerencia General” checkbox. The API field remains optional.

`GET /ats/vacancy-approval-workflow` is reachable when the company has `ats.approvals` **or** `ats.vacancy-requests`, so a leader can load the global levels. `PUT` still requires `ats.vacancy.manage`.

Default evaluators (`VacancyEvaluatorDefault`) use the same cargo/occupant rule. They are snapshotted to `VacancyRequestEvaluator` on submit. **Procesos activos** can insert/update/delete pending approval steps and evaluators who have not yet recorded an interview answer on that process.

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
- `assignedRecruiterEmployeeId` is optional. Recruiter HOME lists and metrics only include vacancies assigned to the current recruiter's linked employee. `GET /ats/vacancies` and vacancy get/publish/preview for a `RECRUITER` without `CLIENT_ADMIN` are scoped to that assignee. `PATCH /ats/vacancies/:id` with `assignedRecruiterEmployeeId` (or `null`) requires `ats.vacancy.manage`. The employee must be ACTIVE, linked to a user, and hold `RECRUITER` or `CLIENT_ADMIN` in the company. The admin UI lists only employees with role `RECRUITER` (`GET /ats/vacancies/recruiters`).
- Optional `salaryAmount` / `salaryCurrency` / `showSalaryPublic`. The public job URL includes salary only when `showSalaryPublic` is true and an amount is set. The public page (and recruiter preview) shows cargo fields: name, mission/vision, responsibilities, and required experience. The admin vacancy detail toggles salary visibility.

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
| GET | `/ats/vacancy-approval-workflow` | read (feature `ats.approvals` or `ats.vacancy-requests`) |
| PUT | `/ats/vacancy-approval-workflow` | manage |
| GET | `/ats/position-occupants?positionId=` | read (colaboradores ACTIVE del cargo; no exige `userId`) |
| GET/PUT | `/ats/evaluator-defaults` | read / manage |
| GET | `/ats/active-processes` | read |
| GET/PUT | `/ats/active-processes/:id/approvals` | read / manage |
| GET/PUT | `/ats/active-processes/:id/evaluators` | read / manage |
| GET | `/ats/vacancies/recruiters` | read |
| GET/PATCH | `/ats/vacancies` | read / manage |
| POST | `/ats/vacancies/:id/publish` | manage |
| POST | `/ats/vacancies/:id/unpublish` | manage |
| GET | `/ats/vacancies/:id/public-preview` | read (assigned vacancies for recruiters) |
| GET | `/public/jobs/:publicId` | Public |
| POST | `/public/jobs/:publicId/parse-cv` | Public (rate limited; PDF/DOCX/TXT) |
| POST | `/public/jobs/:publicId/apply` | Public (rate limited; optional CV file) |

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
The public form uploads a CV (`PDF`, `DOCX` or `TXT`, max 5 MB):
`POST /public/jobs/:publicId/parse-cv` extracts name, email, phone and
document to prefill the form; apply stores the file on the candidate so
recruiters can download it from the pipeline or candidate profile.
Unpublishing never removes ATS history. CAPTCHA is a possible future anti-spam
layer; this phase uses strict DTO validation and endpoint throttling.
