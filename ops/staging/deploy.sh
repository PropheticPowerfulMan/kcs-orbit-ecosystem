#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/ops/staging/compose.yml"
ENV_FILE="${STAGING_ENV_FILE:-/etc/kcs-orbit/staging.env}"
BRANCH="$(git -C "$ROOT_DIR" branch --show-current)"
RELEASE="$(git -C "$ROOT_DIR" rev-parse HEAD)"
[[ "$BRANCH" != "main" ]] || { echo "Refusing to deploy staging from main." >&2; exit 1; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Refusing to deploy a dirty staging worktree." >&2; exit 1; }
[[ -r "$ENV_FILE" ]] || { echo "Missing or unreadable staging env: $ENV_FILE" >&2; exit 1; }
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || { echo "$ENV_FILE must have mode 600." >&2; exit 1; }
docker network inspect kcs-orbit-production_kcs_staging >/dev/null
export STAGING_RELEASE="$RELEASE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans --wait --wait-timeout 300
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
