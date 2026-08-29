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

## Home by role

`GET /companies/current/features` also returns the membership HOME persona for the active company:

| Field | Meaning |
|-------|---------|
| `roleCodes` | Company RBAC role codes on the membership |
| `hasDirectReports` | Linked employee has at least one ACTIVE DIRECT report |
| `homeRole` | Persona used by `/dashboard`: `CLIENT_ADMIN`, `RECRUITER`, `PERFORMANCE_MANAGER`, `LEADER`, `COLLABORATOR` |

Precedence: Administrador → Reclutador → Gestor de performance → Líder (role **or** people in charge) → Colaborador. The four product HOME roles are Colaborador, Líder, Reclutador and Administrador.

### Colaborador HOME

`GET /home` (requires `company.read`) returns the collaborator feed: open vacancies, own employee profile, pending vacancy-request approvals **only if this user is the current step actor**, and interviews where they are assigned as interviewer.

Inicio also shows **Información de la compañía**: a right-hand panel with one scheduled image or video. Readers only see it while it is live (`publishedAt` ≤ now < `unpublishedAt`) and has a title plus media.

| Action | Endpoint |
|--------|----------|
| View company info (live for readers; unpublished for admins) | `GET /home/company-info` (`company.read`) |
| Edit title, description, publication dates | `PATCH /home/company-info` (`company.manage`) |
| Stream image/video | `GET /home/company-info/media` (`company.read`; unpublished only with `company.manage`) |
| Upload image/video | `POST /home/company-info/media` (`company.manage`) |
| Remove media | `DELETE /home/company-info/media` (`company.manage`) |
| Edit own profile | `PATCH /home/profile` — cannot change nombres, apellidos, identificación, fecha de nacimiento |
| Apply to an open vacancy | `POST /home/vacancies/:id/apply` — modal in Inicio; creates candidate + application |
| Decide an assigned approval | existing `POST /ats/vacancy-requests/:id/approve\|reject` (service still checks the current step actor) |

Inicio filters shortcuts by enabled company modules/features; it does not invent metrics.

### Líder HOME

Same feed as Colaborador (`GET /home`, profile self-edit, internal apply, assigned approvals/evaluations) plus a **Solicitar proceso de selección** button. The button opens the vacancy-request form in a floating window (`POST /ats/vacancy-requests`; requires `ats.vacancy.request` and the `ats.vacancy-requests` company feature). The form shows the global approval levels (read-only) and lets the leader add extra levels for that request. The requester is the leader's linked employee; they cannot proxy another collaborator from Inicio.

### Reclutador HOME

Same feed as Colaborador (`GET /home`, profile self-edit, internal apply, assigned approvals/evaluations) plus:

| Section | Source |
|---------|--------|
| Procesos asignados | Vacancies where `assignedRecruiterEmployeeId` is the recruiter's linked employee |
| Métricas | Counts only over those assigned vacancies (applications, hires, pending interviews, headcount) |

Assign a recruiter on the vacancy detail (`PATCH /ats/vacancies/:id` with `assignedRecruiterEmployeeId`). The assignee must be an ACTIVE employee with role `RECRUITER` or `CLIENT_ADMIN`.

### Administrador HOME

Same feed as Colaborador (`GET /home`, profile self-edit, internal apply, assigned approvals/evaluations) plus:

| Section | Source |
|---------|--------|
| Todos los procesos de selección | `GET /ats/vacancies` — every vacancy in the company, any status |
| Información de la compañía | Right-hand panel: upload image or video, title, description, publication and unpublication dates (`PATCH /home/company-info`, `POST /home/company-info/media`) |
| Configuración de organización | employees, org chart, units, areas, positions, levels, custom fields, import |
| Configuración del ATS | default approval levels, default evaluators, active processes, interview templates |
| Configuración de performance | cycles, competencies, scales, goal periods |
| Configuración del sistema | branding |

Shortcuts stay filtered by enabled company modules/features.

### Superadministrador HOME

`/platform` is the platform-owner HOME. It is not the company `/dashboard`.

| Section | Source |
|---------|--------|
| Configuración de organización, ATS, performance y sistema | Informational on `/platform`; configure them after **Entrar como administrador** (real `CLIENT_ADMIN` membership) |
| Opciones premium | Per-company toggles: firma digital, grabación de entrevista, generación de PDI (`PUT /platform/admin/companies/:id/premium`) |
| Facturación | Costs (impuestos, licencias, suscripciones), % margen, calculated charge and net profit (`GET /platform/admin/billing`, `PUT /platform/admin/companies/:id/billing`) |

Interview microphone transcription is shown only when `premium.interview-recording` is enabled. Digital signature and PDI are entitlements until those products exist.

## Logout

1. `POST /auth/logout` with Bearer access token (best effort)
2. Clear memory session + tenant UI state even if logout API fails
3. Redirect to `/login`

Tenant branding is loaded only inside the authenticated company shell and is keyed by `activeCompanyId`. Global `/login` always uses Plataforma HR colors. See [company-branding.md](./company-branding.md).

## Cross-origin note

Local web (`:3000`) and API (`:3001`) are different origins. Cookie uses `SameSite=None; Secure` so the browser sends it on credentialed refresh. See [security.md](./security.md).
