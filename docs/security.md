# Security (Fase 10 — Production Security Hardening)

## Threat model (practical)

### Assets

| Asset | Sensitivity |
|-------|-------------|
| Password hashes / JWT secrets | Critical |
| Access tokens (short-lived) | High |
| Refresh sessions (HttpOnly cookie) | Critical |
| Users, memberships, roles/permissions | High |
| Employees, candidates, interviews, transcripts | High / PII |
| Offers, hiring, salaries in offers | High |
| Performance evaluations / results | High |
| Goals / check-ins / comments | High |
| AuditLog | Integrity / accountability |

### Trust boundaries

```
Browser (Next.js)  →  NestJS API  →  PostgreSQL
        ↑ cookies/CORS/Origin        ↑ Prisma parameterized
```

### Primary risks and mitigations

| Risk | Mitigation |
|------|------------|
| XSS | React text rendering; no `dangerouslySetInnerHTML`; FE `safeHttpUrl` for links |
| CSRF (refresh cookie) | `SameSite` + CORS allowlist + Origin check on `/auth/login|refresh|logout` + `credentials` only to API |
| Token theft (XSS) | Refresh **not** in Web Storage; HttpOnly cookie; access in memory |
| Refresh replay | Rotation + Argon2id hash; reuse of an old refresh **revokes the whole session** |
| IDOR / tenant breakout | `X-Company-Id` + membership ACTIVE + queries scoped by `companyId` |
| Privilege escalation | RBAC from DB; Platform Owner from DB flag |
| Brute force / stuffing | Throttle on login/refresh (+ sensitive mutations) |
| SQL injection | Prisma + tagged `$queryRaw` templates (no string concat) |
| Mass assignment | Global `whitelist` + `forbidNonWhitelisted` |
| Unsafe CORS | Parsed allowlist; production rejects `*` / empty |
| Secret leakage | Env validation; `.env` gitignored; no secret logs |
| CSV injection | `sanitizeCsvCell` for `=+-@` |
| Open redirects | No user-controlled redirect params |
| Oversized payloads | JSON body limit (`JSON_BODY_LIMIT`, default `1mb`) |

## Refresh cookie

| Attribute | Value |
|-----------|--------|
| Name | `tsc_refresh` |
| HttpOnly | `true` |
| Secure | `true` in production; also when `SameSite=None` (incl. local cross-origin) |
| SameSite | Default `none` (SPA `localhost:3000` → API `3001`). Override with `COOKIE_SAMESITE` |
| Path | `COOKIE_PATH` (default `/auth`). Use `/api/auth` when the browser calls `/api/auth/*` behind a reverse proxy. Login, refresh and logout share this path. |
| Max-Age | From `JWT_REFRESH_TTL` |

JSON login/refresh responses **do not** include `refreshToken`.

## CSRF strategy

**Chosen:** defense-in-depth without a separate double-submit CSRF token.

1. Refresh cookie is not readable by JS (HttpOnly).
2. Cross-site POSTs must satisfy CORS (`credentials: true` + allowlist).
3. Middleware rejects non-allowlisted `Origin` on auth mutations when `Origin` is present.
4. `SameSite=None` is required for split origins; combined with Origin/CORS checks.

An explicit CSRF token is **not** used (would be decorative if not validated end-to-end). Revisit if API and web share a site cookie (`SameSite=Lax`) behind one domain.

## Session revocation semantics

- **Refresh:** always checks `UserSession` (`revokedAt`, expiry, hash). Logout/reuse invalidate refresh immediately.
- **Access JWT:** validated by signature + expiry + `type=access`. **`sid` is not looked up on every request** (latency trade-off). After logout, a stolen access token may work until `JWT_ACCESS_TTL` (default 15m). Documented accepted debt unless a DB session check is added later.

## User / membership status

- Login/refresh require `User.status === ACTIVE` and `deletedAt === null`.
- Tenant context requires ACTIVE membership + ACTIVE company + ACTIVE user
  (or Platform Owner + ACTIVE company when entering without membership).
- Role/permission changes take effect from DB on next authorized request (not from client claims).

## CORS

- `CORS_ORIGINS` comma-separated, trimmed, no trailing slash.
- Production: required, no wildcards.
- Dev: defaults to `http://localhost:3000` if empty.

## Security headers

**API (Helmet):** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS in production HTTPS. CSP disabled on API (JSON).

**Next.js:** CSP (document), `nosniff`, `DENY` framing, `Referrer-Policy`, `Permissions-Policy` (microphone allowed for browser STT). See `apps/web/next.config.ts`.

## Environment validation

Startup (`validateSecurityEnv`) fails fast in production on:

- missing `DATABASE_URL` / JWT secrets
- equal access/refresh secrets
- weak/known-default secrets (&lt; 32 chars or denylist)
- empty/wildcard CORS

Never logs secret values.

## Password hashing

Argon2id with pinned params: `memoryCost=19456`, `timeCost=2`, `parallelism=1`. Verify reads params from existing hashes.

There is no end-user password-change API yet; DEV/QA seed passwords are env-driven and **blocked when `NODE_ENV=production`**.

## .env hygiene

- Tracked examples only: `.env.example`, `apps/web/.env.example`.
- `apps/api/.env` must stay gitignored / untracked.
- **Before production:** rotate any secrets that ever lived in a historically tracked `.env`. Generate new `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Do not reuse DEV secrets.

## Rate limiting

In-memory Nest Throttler on login/refresh and selected sensitive mutations (offer respond, hire, evaluation submit). **Debt:** multi-instance needs a shared store (Redis) — out of scope for Fase 10.

## Audio / STT

API does not accept audio uploads. Browser STT keeps audio local; `localRecordingName` is metadata only.

## Dependency / source maps

- Run `pnpm audit` regularly; fix critical/high with compatible upgrades; majors as debt.
- Next: `productionBrowserSourceMaps: false`.
- Nest emits source maps in `dist/` for server debugging — do not expose `dist` publicly.

## Health

`GET /health` → `{ "status": "ok" }` only.
