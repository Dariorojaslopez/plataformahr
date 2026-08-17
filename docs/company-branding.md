# Company branding (tenant appearance)

Each company can set a **commercial name**, **logo**, and **primary brand color**. This is not a theme builder, white-label suite, or per-user skin.

## What already existed

| Piece | Reality |
|--------|---------|
| `Company.name` | Commercial / visible name |
| `Company.legalName` | Optional razón social — **not duplicated** |
| Logo / color / favicon | Did not exist |
| File uploads | Did not exist (CSV import is in-memory text) |
| Login | Global `/login` — no tenant, no domain routing |
| RBAC | `company.read` (view) and `company.manage` (settings) |
| AuditLog | Append-only JSON metadata |
| Docker | Named volume only for PostgreSQL (`talento_prod_pgdata`) |

## Model

Additive nullable columns on `companies`:

- `brandPrimaryColor` (`#RRGGBB` or null)
- `logoFileName` (server-generated UUID + extension)
- `logoMimeType` (`image/png` \| `image/jpeg` \| `image/webp`)
- `logoUpdatedAt`

A company with all-null branding keeps Plataforma HR defaults. No backfill.

Out of v1: secondary color, favicon, welcome text, SVG, custom CSS, email templates.

## Storage

Logos are **files**, not PostgreSQL bytes and not base64.

| Environment | Directory |
|-------------|-----------|
| Local | `COMPANY_UPLOADS_DIR` or `apps/api/var/company-uploads` |
| Production | `/data/company-uploads` on volume `talento_prod_company_uploads` |

Layout: `{uploadsDir}/{companyId}/{uuid}.png`. The API never returns the filesystem path.

Allowed types: PNG, JPEG, WebP (magic bytes). Max 1 MiB, max 2048×2048. SVG is rejected.

`docker compose up`, image rebuild, SHA deploy, and application rollback **do not** remove named volumes. Never run `docker compose down -v`.

## API

All routes require Bearer + `X-Company-Id`. Tenant comes from `CompanyContextGuard`, never from the body.

| Method | Path | Permission |
|--------|------|------------|
| `GET` | `/companies/current/branding` | `company.read` |
| `PATCH` | `/companies/current/branding` | `company.manage` |
| `GET` | `/companies/current/branding/logo` | `company.read` |
| `POST` | `/companies/current/branding/logo` | `company.manage` |
| `DELETE` | `/companies/current/branding/logo` | `company.manage` |

`PATCH` body: `{ name?, brandPrimaryColor? }`. `brandPrimaryColor: null` restores the platform default. Color must match `#RRGGBB` (stored uppercase). Arbitrary CSS is rejected.

Invalid MIME → 415. Oversized file → 413. Cross-tenant header → 403.

## Frontend

**Configuración → Apariencia** (`/settings/branding`) edits name, color, and logo with a live preview.

Authenticated shell (`AppShell`) loads branding keyed by **active company id**. Switching company clears the React Query cache (`TenantCacheBoundary`) and reapplies tokens. Global `/login` and `/select-company` keep Plataforma HR branding (`#0F5C5A`).

Brand tokens only: `--primary`, `--ring`, `--sidebar-accent`, `--primary-foreground`. Semantic `--destructive`, `--warning`, `--success` are not overwritten.

## Backup debt

CD logical backups cover **PostgreSQL only**. Logo files on `talento_prod_company_uploads` are **not** in `scripts/backup-postgres.sh`.

Later: snapshot or rsync that volume off-host on the same cadence as DB dumps; document restore as “DB dump + uploads volume”. Do not store logos in the Postgres volume.
