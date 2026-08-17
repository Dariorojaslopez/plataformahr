# Frontend — Organization (Phase 05B)

## Permissions UX

There is **no API** that returns effective membership permissions (`organization.manage`, etc.).

Manage actions are visible in the UI; the backend remains authoritative and returns `403` when forbidden.

## Data enrichment

`GET /organization/employees` returns foreign keys only. Names for area/position/business unit are resolved from list endpoints client-side.

## Optional business units

A company is not required to use business units. The minimum valid structure is Company → Area → JobLevel → Position → Employee.

In area forms, **Unidad de negocio** is optional. Empty selection maps to `undefined` on create and `null` on update — never a sentinel like `"none"`. When the company has no business units, the Unidad column and employee filter are omitted. When it does and an area/employee has none, the UI shows `Sin unidad de negocio`.
