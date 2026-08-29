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

On **Niveles**, each row has **Competencias**: a checklist of the company competency catalog (name, system code, status). Selection is optional and saved with `PUT /organization/job-levels/:id/competencies` `{ competencyIds }`. Empty array clears the level. The create-level form does not require competencies.

The competency **catalog** lives under Organización (`/organization/competencies`). Create/edit asks for **Nivel** (required) and does not show Código or escala. The API remains `GET/POST/PATCH /performance/competencies` (`jobLevelId` assigns `JobLevelCompetency`). `/performance/competencies` redirects to the organization page. Competency ratings use the qualitative scale from **Escalas de calificación** (`/organization/scales`; API `/performance/scales`). `/performance/scales` redirects to the organization page.

The scale form asks for name, description, status, kind (cualitativa / cuantitativa) and format. Qualitative formats: numérica (min–max), descriptiva (2–5 texts) or Likert (icon + min–max). Quantitative formats: porcentaje (min–max), moneda or numérico (max 2 decimals). Create with a format auto-creates discrete levels for qualitative scales; quantitative scales have none.

## Assigned codes

**Código** on unidades de negocio, áreas, niveles, descripciones de cargo, and competencias is assigned by the API (`001`, `002`, …) when the client omits it. Create/edit forms do not show the field. Lists may still display the code. Import CSV still requires codes as match keys.

## Custom fields

**Campos personalizados** (`/organization/position-fields`) lists company field definitions. Admins name the field, pick **Dónde aparece** (**Formulario de descripciones de cargo** or **Formulario de personas**), pick a type (texto, número, sí/no, fecha, lista), mark required, add SELECT options, reorder, and deactivate. The technical `key` is generated from the name and is not shown. `key` and `appliesTo` are locked after create.

Create/edit **Descripciones de cargo** renders active `POSITION` definitions. Create/edit **Personas** (colaboradores) renders active `EMPLOYEE` definitions. Inactive fields with stored values appear as read-only `Etiqueta: Valor`. IDs and keys are not shown on the forms.

## Organigrama

**Organigrama** (`/organization/org-chart`) is a read-only chart of DIRECT reports. Cards show name (link to `/organization/employees/:id`), position, area, optional business unit, and job level when present. Inactive status is badged only when the include-inactive toggle is on.

The company name is a visual root only. Several employees without a visible manager appear as sibling roots under that node. CSS connectors draw the reporting lines in the interactive tree; PNG/PDF export still uses the SVG layout.

The chart can be segmented without another API call: **Unidad de negocio** (hidden if the company has none) and **Nivel**. Combined filters are AND. A person whose manager falls outside the filter is promoted to a root. PNG/PDF export uses the visible tree.

Zoom/pan live in the viewport (no diagram library). PNG/PDF export uses an in-browser SVG layout — no extra npm dependency and no HTML posted to the API. Default query is active employees; the checkbox requests `includeInactive=true`.

## Importación masiva

**Importación masiva** (`/organization/import`) downloads a CSV template, validates it (preview), then applies only if there are no blocking errors. The apply button stays disabled while the preview has errors. Results are summarized per entity (created / updated). Row errors are shown as `Fila N · campo: mensaje`.

## Apariencia de compañía

**Apariencia** (`/settings/branding`) is under Configuración. Admins with `company.manage` set commercial name, primary color (`#RRGGBB`), and logo. The authenticated shell applies `--primary` / `--ring` / `--sidebar-accent` for the active company only. Login stays on Plataforma HR branding. Details: [company-branding.md](./company-branding.md).

