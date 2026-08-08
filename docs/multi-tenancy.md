# Multi-tenancy strategy

## Tenant model

- **Company** is the tenant boundary.
- **User** represents global identity and access credentials. It does **not** store `companyId`.
- **CompanyMembership** determines whether a user belongs to a company (and with which status).
- A user may belong to many companies; a company may have many members.
- **Platform Owner** (`User.isPlatformOwner = true`) operates outside normal membership context and does not require a `CompanyMembership` to administer the platform.

## Trusted tenant resolution

Clients send the selected company in the `X-Company-Id` header for tenant-aware routes.

The backend **never** trusts that header alone:

1. Authenticate the user via access JWT (`sub` / `sid`).
2. `CompanyContextGuard` loads `CompanyMembership` for `(userId, X-Company-Id)`.
3. Membership must be `ACTIVE`, company must be `ACTIVE` and not soft-deleted.
4. A trusted `TenantContext` (`userId`, `companyId`, `membershipId`) is attached to the request.
5. Downstream code must consume `tenantContext.companyId` — not re-read `X-Company-Id`.

Platform Owner does **not** receive automatic tenant data access from `isPlatformOwner` alone. Proxy/impersonation is out of scope for now; tenant endpoints still require a valid membership.

## RBAC

Authorization is membership-scoped and loaded from persistence (not from the JWT):

`User` → `CompanyMembership` → `MembershipRole` → `Role` → `RolePermission` → `Permission`

Use `@RequirePermissions('company.read')` with `PermissionGuard` after `CompanyContextGuard`.

## Future business entities

Any domain entity that belongs to a tenant **must** include `companyId` and be queried only within the resolved tenant scope.

## Out of scope

- Platform Owner company proxy / impersonation
- PostgreSQL Row Level Security (RLS)
- Permission caching
