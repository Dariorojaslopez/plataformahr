# Frontend authentication (Fase 10)

## Current contract

| Endpoint | Response | Cookies |
|----------|----------|---------|
| `POST /auth/login` | `accessToken`, `user`, `companies` | Sets HttpOnly `tsc_refresh` |
| `POST /auth/refresh` | `accessToken` only | Rotates `tsc_refresh` (cookie in, cookie out) |
| `POST /auth/logout` | `{ success: true }` | Clears `tsc_refresh` |
| `GET /auth/me` | identity + companies | — |

The browser **cannot** read the refresh token via JavaScript.

## Session strategy

| Data | Storage | Notes |
|------|---------|-------|
| `accessToken` | **Memory only** | Lost on full reload; restored via cookie refresh bootstrap |
| `refreshToken` | **HttpOnly cookie** (`COOKIE_PATH`, default `/auth`) | Never in `sessionStorage` / `localStorage`. Behind `/api` proxy set `COOKIE_PATH=/api/auth`. |
| `activeCompanyId` | `sessionStorage` | UI tenant selection; API still enforces `X-Company-Id` |
| Sidebar collapsed | `localStorage` | Non-sensitive UI preference |

Legacy key `tsc.refreshToken` is cleared on `clearSession` if present.

## Bootstrap (reload)

1. Status starts as `loading`
2. `refreshAccessToken()` → `POST /auth/refresh` with `credentials: 'include'`
3. On success → `meRequest()` → authenticated
4. On failure → anonymous / login

## Refresh behavior

1. Authenticated `apiRequest` receives `401`
2. Single-flight refresh once
3. Retry original request once
4. If refresh fails → clear session → logged out

Fetch uses `credentials: 'include'` only against `NEXT_PUBLIC_API_URL` (configured API).
The refresh cookie Path must match that public prefix (e.g. `/api/auth` if the API URL ends with `/api`).

## Logout

1. `POST /auth/logout` with Bearer access token (best effort)
2. Clear memory session + tenant UI state even if logout API fails
3. Redirect to `/login`

Tenant branding is loaded only inside the authenticated company shell and is keyed by `activeCompanyId`. Global `/login` always uses Plataforma HR colors. See [company-branding.md](./company-branding.md).

## Cross-origin note

Local web (`:3000`) and API (`:3001`) are different origins. Cookie uses `SameSite=None; Secure` so the browser sends it on credentialed refresh. See [security.md](./security.md).
