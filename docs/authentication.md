# Authentication

## Overview

The API uses email/password login with:

- **Argon2id** password hashing (`memoryCost=19456`, `timeCost=2`, `parallelism=1`)
- Short-lived **JWT access tokens** (Bearer, memory on the client)
- Longer-lived **JWT refresh tokens** in an **HttpOnly** cookie (`tsc_refresh`), bound to `UserSession`
- Refresh token **rotation**, hash storage, and session **revocation**

Passwords and refresh tokens are never stored in plaintext. `passwordHash` and refresh tokens are never returned in JSON API bodies.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/auth/login` | public | Rate limited; sets refresh cookie; generic errors |
| `POST` | `/auth/refresh` | refresh **cookie** | Rate limited; rotates cookie |
| `POST` | `/auth/logout` | Bearer access token | Revokes session; clears cookie |
| `GET` | `/auth/me` | Bearer access token | Identity + active companies; `Cache-Control: no-store` |
| `GET` | `/companies/current` | Bearer + `X-Company-Id` + `company.read` | Tenant-aware sample |
| `GET` | `/companies/current/branding` | Bearer + `X-Company-Id` + `company.read` | Name, color, hasLogo |
| `PATCH` | `/companies/current/branding` | Bearer + `X-Company-Id` + `company.manage` | Name / `#RRGGBB` color |
| `GET` | `/companies/current/branding/logo` | Bearer + `X-Company-Id` + `company.read` | Logo bytes |
| `POST` | `/companies/current/branding/logo` | Bearer + `X-Company-Id` + `company.manage` | Multipart `file` |
| `DELETE` | `/companies/current/branding/logo` | Bearer + `X-Company-Id` + `company.manage` | Remove logo |
| `GET` | `/platform/me` | Bearer + Platform Owner | Platform identity |
| `GET` | `/platform/companies` | Bearer + Platform Owner | ACTIVE companies catalog for tenant entry |
| `GET/POST` | `/platform/admin/companies` | Bearer + Platform Owner | List/provision companies and initial admin |
| `PUT` | `/platform/admin/companies/:id/features` | Bearer + Platform Owner | Standard module/feature entitlements (premium flags are preserved) |
| `PUT` | `/platform/admin/companies/:id/premium` | Bearer + Platform Owner | Digital signature, interview recording, PDI |
| `GET` | `/platform/admin/billing` | Bearer + Platform Owner | Per-company costs, calculated charge, consolidated net profit |
| `PUT` | `/platform/admin/companies/:id/billing` | Bearer + Platform Owner | Tax, license, subscription costs and margin % |
| `PATCH` | `/platform/admin/companies/:id/status` | Bearer + Platform Owner | Activate/suspend a company |
| `POST` | `/platform/admin/companies/:id/access` | Bearer + Platform Owner | Create/activate a real CLIENT_ADMIN membership |
| `POST` | `/auth/change-password` | Bearer | Replace a temporary password |

Platform Owner may call tenant routes with `X-Company-Id` for any **ACTIVE** company without a membership. Regular users still require an ACTIVE membership for that company.

The Platform administration console provisions a company and its first
`CLIENT_ADMIN` atomically. The API generates a high-entropy temporary password,
returns it once, stores only its Argon2id hash, and marks the user with
`mustChangePassword`. Until it is replaced, the JWT guard only allows
`/auth/me`, `/auth/logout`, and `/auth/change-password`.

When a Platform Owner chooses **Entrar como administrador**, the API creates or
reactivates a real membership with role `CLIENT_ADMIN`. Tenant requests then
resolve through that membership (`viaPlatformOwner = false`), preserving the
actor's identity without impersonating another user.

## Tokens

Access payload (minimum):

```json
{ "sub": "<userId>", "sid": "<sessionId>", "type": "access" }
```

Refresh payload (minimum):

```json
{ "sub": "<userId>", "sid": "<sessionId>", "type": "refresh", "jti": "<unique-id>" }
```

Secrets and TTL:

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (must differ; strong in production)
- `JWT_ACCESS_TTL` (default `15m`)
- `JWT_REFRESH_TTL` (default `7d`)

## Session lifecycle

1. Login creates `UserSession`, stores `refreshTokenHash`, sets HttpOnly cookie.
2. Refresh reads cookie only, verifies JWT + hash, rotates token/hash/cookie.
3. Reuse of an old refresh after rotation → session revoked.
4. Logout sets `revokedAt` and clears cookie.
5. Access tokens remain valid until TTL after logout (no per-request DB `sid` check). See [security.md](./security.md).

## Rate limiting

`POST /auth/login`, `POST /auth/refresh`, and selected sensitive mutations use NestJS Throttler (in-memory). Multi-instance shared store is future debt.

## Audit

- `AUTH_LOGIN_SUCCESS`
- `AUTH_REFRESH`
- `AUTH_LOGOUT`

Metadata excludes passwords, tokens and hashes.

## DEV seed

`pnpm db:seed:dev` / `pnpm db:seed:qa` are **forbidden** when `NODE_ENV=production`.

Requires `DEV_*` / QA env credentials for local only.

## See also

- [security.md](./security.md) — threat model, CSRF, CORS, cookies
- [frontend-auth.md](./frontend-auth.md) — browser session bootstrap
