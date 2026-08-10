# Multi-tenancy strategy

## Tenant model

- **Company** is the tenant boundary.
- **User** represents global identity and access credentials. It does **not** store `companyId`.
- **CompanyMembership** determines whether a user belongs to a company (and with which status).
- A user may belong to many companies; a company may have many members.
- **Platform Owner** (`User.isPlatformOwner = true`) operates outside normal membership context and does not require a `CompanyMembership` to administer the platform.
- Platform Owner **may enter any ACTIVE company** by sending `X-Company-Id` (tenant proxy). Access is verified from the database (`isPlatformOwner`), never from the client alone. RBAC for that request grants the full permission catalog (and company role codes for role-gated workflows).

## Trusted tenant resolution

Clients send the selected company in the `X-Company-Id` header for tenant-aware routes.

The backend **never** trusts that header alone:

1. Authenticate the user via access JWT (`sub` / `sid`).
2. `CompanyContextGuard` loads `CompanyMembership` for `(userId, X-Company-Id)`.
3. If membership exists: must be `ACTIVE`, company must be `ACTIVE` and not soft-deleted.
4. If membership is missing: only an ACTIVE Platform Owner may continue, and only if the company is `ACTIVE` and not soft-deleted.
5. A trusted `TenantContext` (`userId`, `companyId`, `membershipId`, `viaPlatformOwner`) is attached to the request.
6. Downstream code must consume `tenantContext.companyId` — not re-read `X-Company-Id`.

## RBAC

Authorization is membership-scoped and loaded from persistence (not from the JWT):

`User` → `CompanyMembership` → `MembershipRole` → `Role` → `RolePermission` → `Permission`

Use `@RequirePermissions('company.read')` with `PermissionGuard` after `CompanyContextGuard`.

When `viaPlatformOwner` is true, permission/role checks treat the actor as having the full catalog (synthetic membership id `__platform_owner__`, never accepted from clients).

## Future business entities

Any domain entity that belongs to a tenant **must** include `companyId` and be queried only within the resolved tenant scope.

## Out of scope

- PostgreSQL Row Level Security (RLS)
- Permission caching
- Creating a real CompanyMembership automatically when the owner enters a tenant
