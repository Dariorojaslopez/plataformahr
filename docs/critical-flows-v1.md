# Critical user flows — V1 matrix

Only flows that exist in the codebase. QA should exercise these on staging.

| FLOW | API | WEB | RBAC | DB | RESULT (fill in QA) |
|------|-----|-----|------|----|---------------------|
| Login | `POST /auth/login` → access + refresh cookie | Login form → session provider | Authenticated user | Session/refresh rows | |
| Refresh session | `POST /auth/refresh` (cookie) | Silent bootstrap / client refresh | Valid refresh | Session rotation | |
| Logout | `POST /auth/logout` | Clears memory access token | Authenticated | Revoke refresh | |
| Company context | Headers `Authorization` + `X-Company-Id` | Company switcher / context | Membership required | Membership lookup | |
| List employees | Organization employees list | Org UI | `employee`/org permissions | Tenant-scoped query | |
| ATS vacancy list | Vacancies list | ATS UI | Recruiter/admin perms | Tenant-scoped | |
| ATS candidate + application | Candidates/applications APIs | ATS UI | Recruiter perms | Tenant-scoped | |
| Interview schedule/update | Interviews API | Interviews UI | Interview perms | Tenant-scoped | |
| Offer / hiring | Offers + hiring APIs | Offers/Hiring UI | Hiring perms | Tenant-scoped | |
| Performance cycle config | Performance APIs | Performance UI | Performance manager/admin | Tenant-scoped | |
| Evaluation responses | Responses APIs | Evaluation UI | Participant/evaluator rules | Tenant-scoped | |
| Goals check-in | Goals/progress APIs | Goals UI | Goal owner/leader perms | Tenant-scoped | |
| Health/ready (ops) | `GET /health`, `GET /ready` | N/A (ops) | Public/ops | DB probe on ready | |
| Metrics scrape (ops) | `GET /metrics` | N/A | Network private | N/A | |

## Isolation checks (mandatory spot)

| Check | Expect |
|-------|--------|
| User company A lists resources with `X-Company-Id=B` without membership | 403 |
| User company A mutates ID belonging to B | 403/404 (no leak) |
| Disabled user login | Denied |
| Role without permission | 403 |

Covered extensively in API e2e (`performance*`, `goals*`, auth/security suites). Add new tests only when a real gap is found.
