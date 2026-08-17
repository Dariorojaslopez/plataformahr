#!/usr/bin/env bash
# Application rollback on the VPS. Does NOT revert Prisma migrations.
# Usage: scripts/rollback-prod.sh <previous-git-sha>
#
# Forbidden: docker compose down, docker compose down -v,
# prisma migrate dev, prisma db push, migrate reset, automatic DB restore.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-common.sh
source "${SCRIPT_DIR}/prod-common.sh"

SHA="${1:-}"

trap 'echo "ERROR: rollback aborted at line $LINENO" >&2' ERR

require_not_root
require_commands
require_sha "$SHA"
require_project_dir
require_env_file

SHA="$(printf '%s' "$SHA" | tr '[:upper:]' '[:lower:]')"

cd "$PROJECT_DIR"

print_forward_only_warning

echo "=== Production application rollback ==="
echo "Project: ${PROJECT_DIR}"
echo "Target image SHA: ${SHA}"

if ! images_exist "$SHA"; then
  echo "ERROR: images ${API_IMAGE}:${SHA} and/or ${WEB_IMAGE}:${SHA} do not exist on this host" >&2
  echo "Rollback of application requires previously built IMAGE_TAG images." >&2
  exit 1
fi

ensure_postgres_up
echo "Skipping migrations (application rollback only)"
export IMAGE_TAG="$SHA"
rollout_api_web "$SHA"
run_healthchecks
write_state_sha "$SHA"

echo "=== Application rollback succeeded ==="
echo "API/Web now running images for SHA ${SHA}"
echo "Database schema was NOT reverted."
