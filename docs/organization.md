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

The same catalog competency may be assigned to several levels. The competency catalog form assigns **one** level on create/edit (`jobLevelId`); additional levels can still be linked from **Niveles**. Assignments start empty after migrate; nothing is auto-filled.

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

## Custom fields

Companies can define extra fields for **positions (Descripciones de cargo)** or **employees (Colaboradores)**. There is no generic engine for candidates or areas. Values are **not** stored in `Position.metadata` / `Employee.metadata` (those columns do not exist) and not in `AuditLog.metadata`.

### Model

| Table | Role |
|--------|------|
| `PositionCustomFieldDefinition` | Tenant-owned field (`companyId`, stable `key`, `label`, `type`, `appliesTo` `POSITION` \| `EMPLOYEE`, `required`, `active`, `sortOrder`) |
| `PositionCustomFieldOption` | SELECT choices. Soft-deactivated (`active=false`); never hard-deleted |
| `PositionCustomFieldValue` | One row per position + definition. Typed columns: `textValue`, `numberValue`, `booleanValue`, `dateValue`, `optionId` |
| `EmployeeCustomFieldValue` | Same typed shape, one row per employee + definition |

Unique `(companyId, appliesTo, key)` on definitions. Unique `(positionId, definitionId)` and `(employeeId, definitionId)` on values. CHECK: at most one typed value column populated.

Existing definitions default to `POSITION`. `appliesTo` is set on create and is immutable.

**Why typed columns, not JSON:** Prisma + PostgreSQL can enforce types, unique-per-definition, and future filters (`WHERE numberValue > x`) without parsing blobs. A JSON bag on `Position` would skip FK integrity to SELECT options and make required/type validation a best-effort parse.

### Types

`TEXT` | `NUMBER` | `BOOLEAN` | `DATE` (`YYYY-MM-DD`) | `SELECT` (value = option UUID)

No formulas, scripts, or arbitrary JavaScript.

### Validation and `required`

- CREATE: every **active + required** definition for that entity (`POSITION` or `EMPLOYEE`) must have a valid value.
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

Duplicate `key` in the same company **and** `appliesTo` → `409`. Same `key` for Descripciones de cargo and Colaboradores is allowed. Same `key` in another company → allowed.

### API

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/organization/position-custom-fields` | read / manage |
| PATCH | `/organization/position-custom-fields/:id` | manage |
| GET/POST/PATCH | `/organization/positions` (+ `/:id`) | read / manage — body/response may include `customFields` |
| GET/POST/PATCH | `/organization/employees` (+ `/:id`) | read / manage — body/response may include `customFields` |

`customFields`: `[{ definitionId, value }]` where `value` is `string | number | boolean | null`. SELECT `value` is the option id.

Roles are not hardcoded; guards use `organization.read` / `organization.manage`.

### Multi-tenant

`companyId` comes from `TenantContext`. A definition, option, or position from company B is `404`/`400` in company A without leaking labels. SELECT options are per definition.

### Audit

Uses existing `AuditLog` via `AuditService`:

- `POSITION_CUSTOM_FIELD_DEFINITION_CREATED` / `_UPDATED`
- `POSITION_CUSTOM_FIELDS_UPDATED` when a Position PATCH includes `customFields`
- `EMPLOYEE_CUSTOM_FIELDS_UPDATED` when an Employee PATCH includes `customFields`

### History

Additive migrations `position_custom_fields` and `custom_field_applies_to`. Existing definitions default to `POSITION`. Existing employees start with zero value rows. No backfill. No DROP.

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
| GET/POST/PATCH | `/organization/employees` (+ `/:id`) | read / manage — body/response may include `customFields` for employee-scoped definitions |
| GET | `/organization/employees/:id/organization-profile` | read |
| GET/POST/DELETE | `/organization/employees/:id/reporting-lines` | read / manage |
| GET | `/organization/org-chart` | read |
| GET | `/organization/import/template` | manage |
| POST | `/organization/import/preview` | manage |
| POST | `/organization/import/apply` | manage |

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
- The web chart can further segment the loaded forest by business unit and job level (AND). Anyone whose DIRECT manager is outside the filter becomes a root. Export follows that visible tree.

### Response

DTO nodes include: `employeeId`, names, `status`, `managerId`, `position`, optional `jobLevel`, `area`, optional `businessUnit`, `children`. No email, phone, address, salary, documents, ATS, or Performance fields.

Loaded with one `company.findFirst` and one `employee.findMany` (DIRECT line nested, `take: 1`). The tree is assembled in memory.

### Permissions

`organization.read`. `companyId` from `TenantContext` / `X-Company-Id`. Cross-tenant headers do not leak another company's chart.

### Export

PNG and PDF are generated in the browser from an SVG layout (company name, generation date, names, titles). The API is not used for export.

### Out of scope

Drag-and-drop, editing managers from the chart, vacant seats, dotted-line, temporal history, Performance, ATS.

## Bulk organization import

Administrative two-phase CSV import. Preview never writes. Apply re-validates inside a single Prisma transaction (60s timeout) and rolls back on failure.

### Format

- UTF-8 CSV (BOM allowed). No XLSX, macros, or formulas.
- One file, discriminator `recordType`: `businessUnit` | `area` | `jobLevel` | `position` | `employee`.
- Structure and people share a stable header so Excel can fill one sheet without a ZIP.
- `companyId` is forbidden. Codes resolve only in the current tenant.

Headers: `recordType,code,name,description,status,rank,headcount,businessUnitCode,areaCode,parentAreaCode,jobLevelCode,positionCode,email,firstName,lastName,managerEmail`.

### Identifiers (create/update)

| Entity | Match | Notes |
|--------|--------|------|
| BusinessUnit / Area / JobLevel / Position | `code` (required in the file) | Create/edit forms do not show a code field: the API assigns the next numeric value (`001`, `002`, …) when omitted. Import still matches by the file code. |
| Employee | `email` (normalized) | There is no `employeeNumber`. Email is the existing unique key. |

No deletes. Missing file rows are left untouched.

Updateable: name, description, status, rank, headcount, area/BU/parent/jobLevel links, employee names/area/position/status/optional BU. Never overwritten from this CSV: phone, address, emergency contacts, `userId`, position mission/custom fields, job-level competencies.

Empty `managerEmail` does not clear an existing DIRECT line.

### Order

BusinessUnits → JobLevels → Areas (parents first) → Positions → Employees → DIRECT reporting lines. Manager rows may appear after the collaborator.

### BusinessUnit optional

Area without `businessUnitCode` is valid. A specified unknown BU is an error.

### Custom fields / competencies

Deferred. Dynamic `cf:*` columns and competency catalogs would make the v1 contract fragile. Second version.

### Limits and security

6 MB, 4 000 data rows, `text/csv` or `text/plain`, no permanent file storage. Template cells are formula-sanitized (`=`, `+`, `-`, `@`). Permission: `organization.manage` including preview. Audit: one `ORGANIZATION_IMPORTED` row with counts, not the file.

### Reporting

Only `DIRECT` via `managerEmail`. Self-manager, missing manager, and cycles (file + existing) are rejected before write.

## Manual SQL

Migration `organization_core_checks` adds:

- CHECK `headcount >= 0`, `rank >= 0`, `childrenCount >= 0`
- CHECK employee ≠ manager
- partial unique index: one `DIRECT` manager per employee
