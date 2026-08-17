#!/usr/bin/env bash
# Shared helpers for production deploy/rollback on the VPS.
# Sourced by scripts/deploy-prod.sh and scripts/rollback-prod.sh.
# Do not run this file directly. Never print secret values.

PROJECT_DIR="${DEPLOY_DIR:-/opt/plataforma-hr}"
COMPOSE_FILE="infrastructure/docker-compose.prod.yml"
ENV_FILE="infrastructure/.env.prod"
STATE_FILE=".deploy-sha"
BACKUP_DIR_NAME="backups"
API_IMAGE="talento-api"
WEB_IMAGE="talento-web"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"
HEALTH_DELAY_SECS="${HEALTH_DELAY_SECS:-4}"

compose() {
  docker compose \
    -f "${PROJECT_DIR}/${COMPOSE_FILE}" \
    --env-file "${PROJECT_DIR}/${ENV_FILE}" \
    "$@"
}

read_env_value() {
  local key="$1"
  local file="${PROJECT_DIR}/${ENV_FILE}"
  local line
  line="$(grep -E "^${key}=" "$file" | tail -n1 || true)"
  printf '%s' "${line#*=}"
}

api_base_url() {
  local port
  port="$(read_env_value API_HOST_PORT)"
  printf 'http://127.0.0.1:%s' "${port:-3001}"
}

web_base_url() {
  local port
  port="$(read_env_value WEB_HOST_PORT)"
  printf 'http://127.0.0.1:%s' "${port:-3000}"
}

require_not_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    echo "ERROR: refuse to run production deploy/rollback as root" >&2
    exit 1
  fi
}

require_commands() {
  local cmd
  for cmd in git docker curl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "ERROR: required command not found: ${cmd}" >&2
      exit 1
    fi
  done
  if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: docker compose plugin is required" >&2
    exit 1
  fi
}

require_project_dir() {
  if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "ERROR: project directory not found: ${PROJECT_DIR}" >&2
    exit 1
  fi
  if [[ ! -f "${PROJECT_DIR}/${COMPOSE_FILE}" ]]; then
    echo "ERROR: compose file not found: ${PROJECT_DIR}/${COMPOSE_FILE}" >&2
    exit 1
  fi
}

require_env_file() {
  local file="${PROJECT_DIR}/${ENV_FILE}"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: missing ${file}" >&2
    echo "Copy infrastructure/.env.prod.example on the VPS and fill production values." >&2
    exit 1
  fi
  if [[ ! -r "$file" ]]; then
    echo "ERROR: cannot read ${file}" >&2
    exit 1
  fi
}

require_sha() {
  local sha="${1:-}"
  if [[ ! "$sha" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
    echo "ERROR: a full or abbreviated git SHA is required (got: ${sha:-empty})" >&2
    exit 1
  fi
}

read_state_sha() {
  local file="${PROJECT_DIR}/${STATE_FILE}"
  if [[ -f "$file" ]]; then
    tr -d '[:space:]' < "$file"
  fi
}

write_state_sha() {
  local sha="$1"
  umask 077
  printf '%s\n' "$sha" > "${PROJECT_DIR}/${STATE_FILE}"
}

images_exist() {
  local tag="$1"
  docker image inspect "${API_IMAGE}:${tag}" >/dev/null 2>&1 \
    && docker image inspect "${WEB_IMAGE}:${tag}" >/dev/null 2>&1
}

wait_for_postgres() {
  local n
  echo "Waiting for PostgreSQL health..."
  for ((n = 1; n <= 60; n++)); do
    if compose exec -T postgres pg_isready >/dev/null 2>&1; then
      echo "PostgreSQL is ready (attempt ${n})"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: PostgreSQL did not become ready" >&2
  return 1
}

wait_for_url() {
  local url="$1"
  local n
  for ((n = 1; n <= HEALTH_ATTEMPTS; n++)); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      echo "OK ${url} (attempt ${n}/${HEALTH_ATTEMPTS})"
      return 0
    fi
    echo "Waiting for ${url} (${n}/${HEALTH_ATTEMPTS})"
    sleep "$HEALTH_DELAY_SECS"
  done
  echo "ERROR: healthcheck failed: ${url}" >&2
  return 1
}

wait_for_api_body() {
  local url="$1"
  local needle="$2"
  local n body
  for ((n = 1; n <= HEALTH_ATTEMPTS; n++)); do
    if body="$(curl -fsS --max-time 5 "$url" 2>/dev/null)" \
      && [[ "$body" == *"$needle"* ]]; then
      echo "OK ${url} contains ${needle} (attempt ${n}/${HEALTH_ATTEMPTS})"
      return 0
    fi
    echo "Waiting for ${url} body ${needle} (${n}/${HEALTH_ATTEMPTS})"
    sleep "$HEALTH_DELAY_SECS"
  done
  echo "ERROR: healthcheck failed: ${url} (expected body to contain ${needle})" >&2
  return 1
}

run_healthchecks() {
  local api web
  api="$(api_base_url)"
  web="$(web_base_url)"
  echo "Running healthchecks against ${api} and ${web}"
  wait_for_api_body "${api}/health" '"status":"ok"'
  wait_for_api_body "${api}/ready" '"status":"ready"'
  wait_for_url "${web}/"
}

ensure_postgres_up() {
  echo "Ensuring PostgreSQL is up (will not remove volumes talento_prod_pgdata or talento_prod_company_uploads)"
  compose up -d postgres
  wait_for_postgres
}

rollout_api_web() {
  local tag="$1"
  export IMAGE_TAG="$tag"
  echo "Rolling out API with IMAGE_TAG=${tag} (postgres left untouched)"
  compose up -d --no-deps --no-build api
  echo "Rolling out Web with IMAGE_TAG=${tag} (postgres left untouched)"
  compose up -d --no-deps --no-build web
}

print_forward_only_warning() {
  cat >&2 <<'EOF'
WARNING: Prisma migrations are forward-only.
Application rollback does NOT revert the database schema.
Do not run prisma migrate dev, prisma db push, migrate reset,
docker compose down, or docker compose down -v.
EOF
}
