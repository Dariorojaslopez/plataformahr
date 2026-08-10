#!/usr/bin/env bash
# Restore a custom-format pg_dump into a target database.
# REQUIRES explicit confirmation flag to avoid accidental restores.
#
# Usage:
#   ./scripts/restore-postgres.sh --yes ./backups/talento-XXXX.dump
#   DATABASE_URL=postgresql://... ./scripts/restore-postgres.sh --yes ./backups/file.dump
#
# Prefer restoring into a temporary / staging database, never blindly into production.

set -euo pipefail

YES=0
DUMP_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y)
      YES=1
      shift
      ;;
    -*)
      echo "ERROR: unknown flag: $1" >&2
      exit 1
      ;;
    *)
      DUMP_FILE="$1"
      shift
      ;;
  esac
done

if [[ "${YES}" -ne 1 ]]; then
  echo "ERROR: refusing to restore without --yes confirmation flag" >&2
  echo "Usage: $0 --yes <file.dump>" >&2
  exit 1
fi

if [[ -z "${DUMP_FILE}" || ! -f "${DUMP_FILE}" ]]; then
  echo "ERROR: dump file not found" >&2
  exit 1
fi

DATABASE_URL_INPUT="${DATABASE_URL:-}"
if [[ -z "${DATABASE_URL_INPUT}" ]]; then
  echo "ERROR: DATABASE_URL env is required" >&2
  exit 1
fi

# Strip Prisma-only query params (e.g. schema=public) that libpq tools may reject.
PG_URL="${DATABASE_URL_INPUT%%\?*}"

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore not found on PATH" >&2
  exit 1
fi

echo "Restoring ${DUMP_FILE} into target DATABASE_URL (credentials not printed)"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="${PG_URL}" \
  "${DUMP_FILE}"

echo "Restore finished."
