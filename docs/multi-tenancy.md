# Multi-tenancy strategy

## Tenant model

- **Company** is the tenant boundary.
- **User** represents global identity and access credentials. It does **not** store `companyId`.
- **CompanyMembership** determines whether a user belongs to a company (and with which status).
- A user may belong to many companies; a company may have many members.
- **Platform Owner** (`User.isPlatformOwner = true`) operates outside normal membership context and does not require a `CompanyMembership` to administer the platform.

## Future business entities

Any domain entity that belongs to a tenant (ATS records, performance cycles, etc.) **must** include `companyId` and be queried only within that tenant scope.

## Trusted tenant resolution

1. The backend must **never** trust a `companyId` sent freely by the frontend as the source of truth.
2. The effective tenant will later be derived from the authenticated principal plus an active `CompanyMembership` (or an explicit platform-owner/proxy context).
3. Every tenant-aware query must isolate rows by the resolved `companyId`.

## RBAC

Authorization is membership-scoped:

`User` → `CompanyMembership` → `MembershipRole` → `Role` → `RolePermission` → `Permission`

Platform ownership is a user flag, not a company membership role.

## Out of scope (this phase)

- Authentication / JWT / session middleware
- Tenant resolution guards
- PostgreSQL Row Level Security (RLS)
