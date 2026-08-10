#!/usr/bin/env bash
# Logical PostgreSQL backup via pg_dump (custom format).
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/backup-postgres.sh
#   ./scripts/backup-postgres.sh postgresql://user:pass@host:5432/db
#
# Requires: pg_dump on PATH (PostgreSQL client tools).
# Does not print connection passwords.

set -euo pipefail

DATABASE_URL_INPUT="${1:-${DATABASE_URL:-}}"
if [[ -z "${DATABASE_URL_INPUT}" ]]; then
  echo "ERROR: DATABASE_URL env or URL argument is required" >&2
  exit 1
fi

# Strip Prisma-only query params (e.g. schema=public) that pg_dump rejects.
PG_URL="${DATABASE_URL_INPUT%%\?*}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found on PATH" >&2
  exit 1
fi

OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${OUT_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/talento-${STAMP}.dump"

echo "Starting pg_dump (custom format) → ${OUT_FILE}"
# pg_dump accepts connection URI; do not echo it.
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${OUT_FILE}" \
  "${PG_URL}"

echo "Backup completed: ${OUT_FILE}"
echo "Size: $(wc -c < "${OUT_FILE}") bytes"
