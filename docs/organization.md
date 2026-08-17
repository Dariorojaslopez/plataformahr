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
| `JobLevel` | Ranked career/organizational level for positions |
| `Position` | Job/role definition (not the occupant) |
| `Employee` | Occupant of a position in an area. `businessUnitId` is optional. |
| `EmployeeReportingLine` | Leadership links (`DIRECT` / `INDIRECT`) |

Minimum valid structure: Company → Area → JobLevel → Position → Employee. Business units may sit between Company and Area when the company uses them. Existing business units are unchanged; the module remains available.

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

## Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET/POST/PATCH | `/organization/business-units` | read / manage |
| GET/POST/PATCH | `/organization/areas` | read / manage |
| GET | `/organization/areas/tree` | read |
| GET/POST/PATCH | `/organization/job-levels` | read / manage |
| GET/POST/PATCH | `/organization/positions` (+ `/:id`) | read / manage |
| GET/POST/PATCH | `/organization/employees` (+ `/:id`) | read / manage |
| GET | `/organization/employees/:id/organization-profile` | read |
| GET/POST/DELETE | `/organization/employees/:id/reporting-lines` | read / manage |

All require JWT + `X-Company-Id`.

## Manual SQL

Migration `organization_core_checks` adds:

- CHECK `headcount >= 0`, `rank >= 0`, `childrenCount >= 0`
- CHECK employee ≠ manager
- partial unique index: one `DIRECT` manager per employee
