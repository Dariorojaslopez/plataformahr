# Frontend — Organization (Phase 05B)

## Permissions UX

There is **no API** that returns effective membership permissions (`organization.manage`, etc.).

Manage actions are visible in the UI; the backend remains authoritative and returns `403` when forbidden.

## Data enrichment

`GET /organization/employees` returns foreign keys only. Names for area/position/business unit are resolved from list endpoints client-side.
