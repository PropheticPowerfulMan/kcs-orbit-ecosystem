#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/ops/production/compose.yml"
ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/kcs-orbit/domains.env}"
RELEASE="${1:-}"

[[ "$RELEASE" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Usage: deploy-kitchen.sh <git-sha>" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

for image in kitchen-api kitchen-web; do
  docker image inspect "kcs/$image:$RELEASE" >/dev/null
done

"$ROOT_DIR/ops/backup/pre-deploy-backup.sh"

env_snapshot="$(mktemp "${ENV_FILE}.pre-kitchen-deploy.XXXXXX")"
services_snapshot="$(mktemp "/tmp/kcs-non-kitchen-services.XXXXXX")"
cp -p -- "$ENV_FILE" "$env_snapshot"
chmod 600 "$env_snapshot"

snapshot_other_services() {
  docker ps --format '{{.Names}}|{{.Image}}|{{.ID}}' |
    grep '^kcs-orbit-production-' |
    grep -Ev '^kcs-orbit-production-kitchen_(api|web)-1[|]' |
    sort
}
snapshot_other_services > "$services_snapshot"

set_release_key() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s/^${key}=.*/${key}=${value}/" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

rollback_on_error() {
  local exit_code=$?
  trap - ERR
  echo "Kitchen deployment failed; restoring the previous Kitchen images." >&2
  cp -p -- "$env_snapshot" "$ENV_FILE"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --no-deps --wait --wait-timeout 300 kitchen_api kitchen_web || true
  rm -f -- "$env_snapshot" "$services_snapshot"
  exit "$exit_code"
}
trap rollback_on_error ERR

set_release_key KITCHEN_API_RELEASE "$RELEASE"
set_release_key KITCHEN_WEB_RELEASE "$RELEASE"
chmod 600 "$ENV_FILE"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --no-deps --wait --wait-timeout 300 kitchen_api kitchen_web

for service in kitchen_api kitchen_web; do
  container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  [[ "$status" == "healthy" || "$status" == "running" ]] || {
    echo "$service is not healthy (status: $status)" >&2
    false
  }
done

current_services="$(mktemp "/tmp/kcs-non-kitchen-services-current.XXXXXX")"
snapshot_other_services > "$current_services"
diff -u "$services_snapshot" "$current_services"
rm -f -- "$current_services" "$services_snapshot" "$env_snapshot"
trap - ERR

echo "Kitchen-only deployment $RELEASE completed. Other application containers were preserved."
