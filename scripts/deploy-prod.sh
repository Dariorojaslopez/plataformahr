#!/usr/bin/env bash
# Production deploy on the VPS. Invoked by GitHub Actions after CI is fully green.
# Usage: scripts/deploy-prod.sh <git-sha>
#
# Forbidden: docker compose down, docker compose down -v,
# prisma migrate dev, prisma db push, migrate reset.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=prod-common.sh
source "${SCRIPT_DIR}/prod-common.sh"

SHA="${1:-}"
PREVIOUS_SHA=""
ROLLED_OUT=0

on_error() {
  local line="${1:-unknown}"
  trap - ERR
  echo "ERROR: deploy aborted at line ${line}" >&2
  if [[ "$ROLLED_OUT" -eq 1 ]]; then
    echo "Healthchecks or post-rollout step failed; attempting application rollback..." >&2
    print_forward_only_warning
    if [[ -n "$PREVIOUS_SHA" && "$PREVIOUS_SHA" != "$SHA" ]] && images_exist "$PREVIOUS_SHA"; then
      export IMAGE_TAG="$PREVIOUS_SHA"
      if rollout_api_web "$PREVIOUS_SHA"; then
        if run_healthchecks; then
          write_state_sha "$PREVIOUS_SHA"
          echo "Rolled back API/Web to ${PREVIOUS_SHA}. Deploy of ${SHA} FAILED." >&2
        else
          echo "ERROR: rollback healthchecks also failed for ${PREVIOUS_SHA}" >&2
        fi
      else
        echo "ERROR: failed to start previous API/Web images ${PREVIOUS_SHA}" >&2
      fi
    else
      echo "ERROR: no previous SHA images available for rollback" >&2
    fi
  fi
  exit 1
}

trap 'on_error $LINENO' ERR

require_not_root
require_commands
require_sha "$SHA"
require_project_dir
require_env_file

SHA="$(printf '%s' "$SHA" | tr '[:upper:]' '[:lower:]')"

cd "$PROJECT_DIR"

echo "=== Production deploy ==="
echo "Project: ${PROJECT_DIR}"
echo "Target SHA: ${SHA}"
echo "Compose: ${COMPOSE_FILE}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: unexpected local changes in ${PROJECT_DIR}; refusing to deploy" >&2
  git status --porcelain >&2
  exit 1
fi

echo "Fetching origin..."
git fetch --prune origin
if ! git cat-file -e "${SHA}^{commit}" 2>/dev/null; then
  git fetch origin "$SHA"
fi
if ! git cat-file -e "${SHA}^{commit}" 2>/dev/null; then
  echo "ERROR: SHA ${SHA} is not available in this git clone" >&2
  exit 1
fi
SHA="$(git rev-parse "${SHA}^{commit}")"
echo "Resolved SHA: ${SHA}"

PREVIOUS_SHA="$(read_state_sha || true)"
if [[ -z "$PREVIOUS_SHA" ]]; then
  PREVIOUS_SHA="$(git rev-parse HEAD)"
fi
echo "Previous SHA: ${PREVIOUS_SHA}"

echo "Checking out ${SHA} (detached HEAD)..."
git checkout --detach "$SHA"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty after checkout; aborting" >&2
  git status --porcelain >&2
  exit 1
fi

ensure_postgres_up

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SHORT="${SHA:0:12}"
BACKUP_DIR="${PROJECT_DIR}/${BACKUP_DIR_NAME}"
BACKUP_FILE="${BACKUP_DIR}/talento-${STAMP}-${SHORT}.dump"
mkdir -p "$BACKUP_DIR"

echo "Backing up PostgreSQL via the postgres container to ${BACKUP_FILE}"
compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl -f /tmp/talento-backup.dump && test -s /tmp/talento-backup.dump'
compose cp postgres:/tmp/talento-backup.dump "$BACKUP_FILE"
compose exec -T postgres rm -f /tmp/talento-backup.dump

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "ERROR: backup file is missing or empty: ${BACKUP_FILE}" >&2
  exit 1
fi
BACKUP_BYTES="$(wc -c < "$BACKUP_FILE" | tr -d ' ')"
if [[ "$BACKUP_BYTES" -lt 1 ]]; then
  echo "ERROR: backup file size is invalid" >&2
  exit 1
fi
echo "Backup completed (${BACKUP_BYTES} bytes)"

export IMAGE_TAG="$SHA"
echo "Building API and Web images tagged ${IMAGE_TAG}"
compose build api web

if ! images_exist "$SHA"; then
  echo "ERROR: expected images ${API_IMAGE}:${SHA} and ${WEB_IMAGE}:${SHA} after build" >&2
  exit 1
fi

echo "Running Prisma migrate deploy (service migrate). Aborting on failure."
# `compose run` does not build unless --build is passed. Do not pass --no-build:
# that flag exists on `up` but not on `run` in Compose plugins older than 2.33.
if ! compose run --rm --no-deps migrate; then
  echo "ERROR: migrate deploy failed; leaving API/Web on previous revision" >&2
  print_forward_only_warning
  exit 1
fi
echo "Migrations applied successfully"

ROLLED_OUT=1
rollout_api_web "$SHA"
run_healthchecks
write_state_sha "$SHA"

echo "=== Deploy succeeded ==="
echo "SHA: ${SHA}"
echo "Images: ${API_IMAGE}:${SHA} ${WEB_IMAGE}:${SHA}"
echo "Backup: ${BACKUP_FILE}"
echo "Health: API /health /ready and Web / OK"
