# Organization core

## User vs Employee

- **User**: platform identity and access (authentication, memberships, RBAC).
- **Employee**: person inside a company's organizational structure.

They are intentionally separate:

- collaborators can be loaded before they have login access;
- hired candidates can later become employees;
- admin users are not automatically HR records.

An `Employee` always belongs to one `Company`. `userId` is optional. When set, that user must have an active membership in the same company, and a user may have at most one employee record per company (but may have employees in different companies).

## Structure

| Entity | Role |
|--------|------|
| `BusinessUnit` | Optional grouping. Companies may have zero business units. |
| `Area` | Hierarchical unit (`parentAreaId`). `businessUnitId` is optional (`null` is valid). |
| `JobLevel` | Ranked career/organizational level for positions. May have zero or more competencies. |
| `JobLevelCompetency` | Tenant-scoped many-to-many: a job level ↔ catalog `Competency`. Unique `(jobLevelId, competencyId)`. |
| `Position` | Job/role definition (not the occupant). Optional `jobLevelId` pointing at `JobLevel`. |
| `Employee` | Occupant of a position in an area. `businessUnitId` is optional. |
| `EmployeeReportingLine` | Leadership links (`DIRECT` / `INDIRECT`) |

Minimum valid structure: Company → Area → JobLevel → Position → Employee. Business units may sit between Company and Area when the company uses them. Existing business units are unchanged; the module remains available.

Competencies are configured **on the JobLevel**, not on the Position:

Company → [BusinessUnit] → Area → JobLevel → Competencies → Position → Employee

`Position.jobLevelId` is the real link (nullable). There is no Position↔Competency table.

A job level may be created with no competencies. The same catalog competency may be assigned to several levels. Assignments start empty after migrate; nothing is auto-filled.

Live `JobLevelCompetency` rows are **not** historical. Performance still evaluates the competencies copied onto a cycle (`PerformanceCycleCompetency`) and frozen into `PerformanceEvaluationCompetency` when a participant is materialized. Editing a level tomorrow must not rewrite closed evaluations. See [performance-evaluations.md](./performance-evaluations.md) and `resolveCompetenciesForEmployee` in `apps/api/src/performance/job-level-competencies.ts`.

## Reporting lines

- `DIRECT`: at most one per employee (enforced by partial unique index + service).
- `INDIRECT`: multiple allowed.
- Employee ≠ manager; both must share company.
- Cycles (`A→B→C→A`) are rejected in application logic.

**Decision:** becoming a direct manager does **not** automatically assign/remove the `LEADER` RBAC role in this phase.

## Multi-tenant rules

- `companyId` always comes from `TenantContext`, never from request bodies.
- Related entities (area, position, job level, business unit, manager) are validated against the same tenant.
- Soft-deleted rows (`deletedAt`) are excluded from normal reads.

## Anti-cycle logic

- Areas: walk ancestor chain when assigning `parentAreaId`.
- Reporting: treat edges as employee → manager and DFS from the proposed manager.

## Permissions

- `organization.read` — GET endpoints
- `organization.manage` — POST/PATCH/DELETE relation endpoints

Seeded for `CLIENT_ADMIN` (read+manage) and read-only for `LEADER`, `RECRUITER`, `PERFORMANCE_MANAGER`, `COLLABORATOR`.

## Position custom fields

Companies can define extra fields for **positions only** (not employees, candidates, or areas). There is no generic custom-field engine yet; this is the first tenant-scoped implementation. Values are **not** stored in `Position.metadata` (that column does not exist) and not in `AuditLog.metadata`.

### Model

| Table | Role |
|--------|------|
| `PositionCustomFieldDefinition` | Tenant-owned field (`companyId`, stable `key`, `label`, `type`, `required`, `active`, `sortOrder`) |
| `PositionCustomFieldOption` | SELECT choices. Soft-deactivated (`active=false`); never hard-deleted |
| `PositionCustomFieldValue` | One row per position + definition. Typed columns: `textValue`, `numberValue`, `booleanValue`, `dateValue`, `optionId` |

Unique `(companyId, key)` on definitions. Unique `(positionId, definitionId)` on values. CHECK: at most one typed value column populated.

**Why typed columns, not JSON:** Prisma + PostgreSQL can enforce types, unique-per-definition, and future filters (`WHERE numberValue > x`) without parsing blobs. A JSON bag on `Position` would skip FK integrity to SELECT options and make required/type validation a best-effort parse.

### Types

`TEXT` | `NUMBER` | `BOOLEAN` | `DATE` (`YYYY-MM-DD`) | `SELECT` (value = option UUID)

No formulas, scripts, or arbitrary JavaScript.

### Validation and `required`

- CREATE: every **active + required** definition must have a valid value.
- UPDATE: `required` is enforced **only when `customFields` is present** in the body (treated as a snapshot of active fields). PATCH of name/area/etc. without `customFields` does not backfill or reject historical positions.
- GET/list never fail because a later `required=true` was turned on.

Turning on `required` later does **not** invalidate existing positions on read.

### Definition changes

| Change | Behavior |
|--------|----------|
| `label`, `sortOrder` | Values kept |
| `active=false` | Values kept; field no longer asked on create/edit; GET still returns stored value |
| SELECT options | Rename/reorder/deactivate. Missing options are deactivated, not deleted. Stored option ids stay valid |
| `type` | Forbidden with 409 if any value exists; allowed if none |
| `key` | Immutable after create |
| Delete definition | **Not implemented.** Deactivate instead |

Duplicate `key` in the same company → `409`. Same `key` in another company → allowed.

### API

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/organization/position-custom-fields` | read / manage |
| PATCH | `/organization/position-custom-fields/:id` | manage |
| GET/POST/PATCH | `/organization/positions` (+ `/:id`) | read / manage — body/response may include `customFields` |

`customFields`: `[{ definitionId, value }]` where `value` is `string | number | boolean | null`. SELECT `value` is the option id.

Roles are not hardcoded; guards use `organization.read` / `organization.manage`.

### Multi-tenant

`companyId` comes from `TenantContext`. A definition, option, or position from company B is `404`/`400` in company A without leaking labels. SELECT options are per definition.

### Audit

Uses existing `AuditLog` via `AuditService`:

- `POSITION_CUSTOM_FIELD_DEFINITION_CREATED` / `_UPDATED`
- `POSITION_CUSTOM_FIELDS_UPDATED` when a Position PATCH includes `customFields`

### History

Additive migration `position_custom_fields`. Existing positions start with zero value rows. No backfill. No DROP.

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH | `/organization/business-units` | read / manage |
| GET/POST/PATCH | `/organization/areas` | read / manage |
| GET | `/organization/areas/tree` | read |
| GET/POST/PATCH | `/organization/job-levels` | read / manage |
| GET/PUT | `/organization/job-levels/:id/competencies` | read / manage |
| GET/POST/PATCH | `/organization/positions` (+ `/:id`) | read / manage |
| GET/POST/PATCH | `/organization/position-custom-fields` (+ `/:id`) | read / manage |
| GET/POST/PATCH | `/organization/employees` (+ `/:id`) | read / manage |
| GET | `/organization/employees/:id/organization-profile` | read |
| GET/POST/DELETE | `/organization/employees/:id/reporting-lines` | read / manage |
| GET | `/organization/org-chart` | read |

All require JWT + `X-Company-Id`.

## Organization chart

Read-only forest of **people**, not a second org structure.

### Source of truth

Hierarchy comes from `EmployeeReportingLine` where `type = DIRECT` (`employeeId` → `managerEmployeeId`). There is no `Employee.managerId` column.

Do **not** infer who reports to whom from BusinessUnit → Area → JobLevel → Position. Those entities are context on each node (`Employee` → `Position` → optional `JobLevel` → `Area` → optional `BusinessUnit`).

`INDIRECT` (dotted-line) reporting is out of scope and is not drawn.

### Integrity

Write-path rules already live in `ReportingLinesService` (no schema change for the chart):

- manager and employee must share company (`requireEmployee`);
- employee cannot be their own manager;
- at most one `DIRECT` manager (partial unique index + `409`);
- cycles (direct or indirect) are rejected (`wouldCreateReportingCycle`).

The chart builder still breaks any stored cycle so rendering cannot recurse forever.

### Roots and virtual company node

Employees whose DIRECT manager is missing from the visible set (no manager, manager inactive/filtered, or manager not loaded) become roots. Multiple roots are valid. The UI/export may show a **virtual company node** as a visual parent; it is not persisted.

### Filters

- Soft-deleted employees (`deletedAt`) are never included.
- Default: `status = ACTIVE` only.
- `GET /organization/org-chart?includeInactive=true` also includes `INACTIVE` and `TERMINATED`.

### Response

DTO nodes include: `employeeId`, names, `status`, `managerId`, `position`, optional `jobLevel`, `area`, optional `businessUnit`, `children`. No email, phone, address, salary, documents, ATS, or Performance fields.

Loaded with one `company.findFirst` and one `employee.findMany` (DIRECT line nested, `take: 1`). The tree is assembled in memory.

### Permissions

`organization.read`. `companyId` from `TenantContext` / `X-Company-Id`. Cross-tenant headers do not leak another company's chart.

### Export

PNG and PDF are generated in the browser from an SVG layout (company name, generation date, names, titles). The API is not used for export.

### Out of scope

Drag-and-drop, editing managers from the chart, vacant seats, dotted-line, temporal history, Performance, ATS.

## Manual SQL

Migration `organization_core_checks` adds:

- CHECK `headcount >= 0`, `rank >= 0`, `childrenCount >= 0`
- CHECK employee ≠ manager
- partial unique index: one `DIRECT` manager per employee
