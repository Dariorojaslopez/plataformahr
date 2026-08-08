# Frontend authentication (Phase 05A)

## Current contract

The API returns `accessToken` + `refreshToken` in JSON bodies for:

- `POST /auth/login`
- `POST /auth/refresh`

There are **no HttpOnly cookies** for refresh tokens yet.

## Session strategy (temporary)

| Data | Storage | Notes |
|------|---------|-------|
| `accessToken` | **Memory only** | Cleared on full page unload; restored via refresh on bootstrap |
| `refreshToken` | `sessionStorage` (temporary) | Survives reload in the same tab; cleared when the tab/session ends |
| `activeCompanyId` | `sessionStorage` | UI tenant selection; security still enforced by API `X-Company-Id` |
| Sidebar collapsed | `localStorage` | Non-sensitive UI preference only |

**`sessionStorage` is not equivalent to an HttpOnly cookie.**

Any XSS in the frontend origin can still read `sessionStorage`. This phase accepts that limitation only because the backend contract currently exposes refresh tokens to JavaScript.

## Planned migration

Move refresh token handling to:

- `HttpOnly`
- `Secure`
- `SameSite` controlled by the API

Then the browser will no longer need `sessionStorage` for tokens, and the frontend will stop persisting refresh tokens in JS-accessible storage.

## Refresh behavior

1. Authenticated `apiRequest` receives `401`
2. Single-flight refresh (`POST /auth/refresh`) runs once
3. Tokens update; original request retries once
4. If refresh fails → clear session → treat as logged out

## Logout

`POST /auth/logout` with Bearer access token, then clear local session and redirect to `/login`.
