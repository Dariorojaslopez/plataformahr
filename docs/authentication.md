# Authentication

## Overview

The API uses email/password login with:

- **Argon2id** password hashing
- Short-lived **JWT access tokens**
- Longer-lived **JWT refresh tokens** bound to `UserSession`
- Refresh token **rotation** and session **revocation**

Passwords and refresh tokens are never stored in plaintext. `passwordHash` is never returned by the API.

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/auth/login` | public | Rate limited |
| `POST` | `/auth/refresh` | refresh token body | Rate limited |
| `POST` | `/auth/logout` | Bearer access token | Revokes current session |
| `GET` | `/auth/me` | Bearer access token | Identity + active companies |
| `GET` | `/companies/current` | Bearer + `X-Company-Id` + `company.read` | Tenant-aware sample |
| `GET` | `/platform/me` | Bearer + Platform Owner | Platform sample |

## Tokens

Access payload (minimum):

```json
{ "sub": "<userId>", "sid": "<sessionId>", "type": "access" }
```

Refresh payload (minimum):

```json
{ "sub": "<userId>", "sid": "<sessionId>", "type": "refresh", "jti": "<unique-id>" }
```

`jti` ensures each rotated refresh token is unique even within the same second.

Secrets and TTL are configured via env:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL` (default `15m`)
- `JWT_REFRESH_TTL` (default `7d`)

Access and refresh use **different** secrets. An access token is rejected by `/auth/refresh`.

## Session lifecycle

1. Login creates a `UserSession` and stores only `refreshTokenHash`.
2. Refresh verifies the JWT + hash, then rotates the refresh token and updates the hash/`lastUsedAt`.
3. Logout sets `revokedAt` for the current session (`sid` from the access token).
4. Revoked or expired sessions cannot refresh.

## Rate limiting

`POST /auth/login` and `POST /auth/refresh` use NestJS Throttler (in-memory).

This is adequate for a single API instance. If the API is horizontally scaled, replace or back the limiter with a shared store.

## Audit

Safe audit actions recorded today:

- `AUTH_LOGIN_SUCCESS`
- `AUTH_REFRESH`
- `AUTH_LOGOUT`

Metadata excludes passwords, tokens and hashes.

## DEV seed

`pnpm db:seed:dev` creates an idempotent Platform Owner, company and CLIENT_ADMIN for local testing.

Requires:

- `DEV_OWNER_EMAIL` / `DEV_OWNER_PASSWORD`
- `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD`

Refuses to run when `NODE_ENV=production`. Not part of the base RBAC seed.
