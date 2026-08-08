# ATS — Vacancy requests & vacancies

## Scope (Phase 04A)

This phase covers:

- `VacancyRequest` (DRAFT → approval workflow → APPROVED/REJECTED)
- `VacancyApproval` steps
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

On submit (`DRAFT` → `PENDING_APPROVAL`):

1. `DIRECT_MANAGER` — resolved from `EmployeeReportingLine` type `DIRECT`
2. `HR` — temporary `requiredRoleCode = CLIENT_ADMIN`
3. `GENERAL_MANAGER` — only if `generalManagerApprovalRequired`; temporary `requiredRoleCode = CLIENT_ADMIN`

Submit fails if the requester has no DIRECT manager.

Steps must be decided in sequence. Only the current `PENDING` step can be approved/rejected.

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
| `ats.vacancy.read` | List/get requests and vacancies |
| `ats.vacancy.request` | Create/update/submit drafts |
| `ats.vacancy.approve` | Approve/reject (plus step eligibility) |
| `ats.vacancy.manage` | Patch vacancy description/status |

`ats.vacancy.approve` alone is not enough: DIRECT_MANAGER must match the linked employee; HR/GM require the configured role.

## Temporary HR / General Manager decision

Until dedicated approver configuration exists, HR and GENERAL_MANAGER steps authorize via membership role `CLIENT_ADMIN`. They remain separate workflow steps so configuration can replace role resolution later without changing the model.

## Concurrency / idempotency

- Submit uses conditional `updateMany` on `status = DRAFT`
- Step decisions use conditional `updateMany` on `status = PENDING`
- Finalization uses conditional transition to `APPROVED`
- Unique `vacancyRequestId` on `Vacancy` blocks duplicate vacancy creation

## Manual SQL

Migration `ats_vacancy_core_checks` adds CHECKs for:

- `requestedHeadcount >= 1`
- `Vacancy.headcount >= 1`
- `filledCount >= 0` and `filledCount <= headcount`
- type/field coherence for EXISTING vs NEW
- approval `sequence >= 1`

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH | `/ats/vacancy-requests` | read / request |
| POST | `/ats/vacancy-requests/:id/submit` | request |
| POST | `/ats/vacancy-requests/:id/approve\|reject` | approve |
| GET/PATCH | `/ats/vacancies` | read / manage |

All require JWT + validated `X-Company-Id` tenant context.
