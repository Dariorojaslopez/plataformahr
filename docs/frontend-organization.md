# Frontend — Organization (Phase 05B)

## Permissions UX

There is **no API** that returns effective membership permissions (`organization.manage`, etc.).

Manage actions are visible in the UI; the backend remains authoritative and returns `403` when forbidden.

## Data enrichment

`GET /organization/employees` returns foreign keys only. Names for area/position/business unit are resolved from list endpoints client-side.

## Optional business units

A company is not required to use business units. The minimum valid structure is Company → Area → JobLevel → Position → Employee.

In area forms, **Unidad de negocio** is optional. Empty selection maps to `undefined` on create and `null` on update — never a sentinel like `"none"`. When the company has no business units, the Unidad column and employee filter are omitted. When it does and an area/employee has none, the UI shows `Sin unidad de negocio`.

## Job level competencies

On **Niveles**, each row has **Competencias**: a checklist of the company competency catalog (name, optional code, status). Selection is optional and saved with `PUT /organization/job-levels/:id/competencies` `{ competencyIds }`. Empty array clears the level. The create-level form does not require competencies.

## Position custom fields

**Campos personalizados de cargos** (`/organization/position-fields`, sibling of `/organization/positions` so nav highlight stays correct) lists company field definitions. Admins name the field, pick a type (texto, número, sí/no, fecha, lista), mark required, add SELECT options, reorder, and deactivate. The technical `key` is shown only on this screen and is locked after create.

Create/edit **Cargos** renders active definitions dynamically (input / number / checkbox / date / select). Inactive fields with stored values appear as read-only `Etiqueta: Valor`. IDs and keys are not shown on the position form.

## Organigrama

**Organigrama** (`/organization/org-chart`) is a read-only chart of DIRECT reports. Cards show name (link to `/organization/employees/:id`), position, area, optional business unit, and job level when present. Inactive status is badged only when the include-inactive toggle is on.

The company name is a visual root only. Several employees without a visible manager appear as sibling roots under that node.

Zoom/pan live in the viewport (no diagram library). PNG/PDF export uses an in-browser SVG layout — no extra npm dependency and no HTML posted to the API. Default query is active employees; the checkbox requests `includeInactive=true`.

## Importación masiva

**Importación masiva** (`/organization/import`) downloads a CSV template, validates it (preview), then applies only if there are no blocking errors. The apply button stays disabled while the preview has errors. Results are summarized per entity (created / updated). Row errors are shown as `Fila N · campo: mensaje`.

## Apariencia de compañía

**Apariencia** (`/settings/branding`) is under Configuración. Admins with `company.manage` set commercial name, primary color (`#RRGGBB`), and logo. The authenticated shell applies `--primary` / `--ring` / `--sidebar-accent` for the active company only. Login stays on Plataforma HR branding. Details: [company-branding.md](./company-branding.md).

