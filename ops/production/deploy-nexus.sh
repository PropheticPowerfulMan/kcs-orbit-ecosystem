#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/ops/production/compose.yml"
ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/kcs-orbit/domains.env}"
RELEASE="${1:-}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo "Usage: deploy-nexus.sh <full-git-sha>" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
for image in nexus-api nexus-web; do docker image inspect "kcs/$image:$RELEASE" >/dev/null; done

# Preserve the full ecosystem state before changing the two Nexus services.
"$ROOT_DIR/ops/backup/pre-deploy-backup.sh"
previous_release="$(sed -n 's/^KCS_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_api="$(sed -n 's/^NEXUS_API_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_web="$(sed -n 's/^NEXUS_WEB_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_api="${previous_api:-$previous_release}"
previous_web="${previous_web:-$previous_release}"
snapshot="$(mktemp "${ENV_FILE}.nexus-pre-deploy.XXXXXX")"
cp -p -- "$ENV_FILE" "$snapshot"
chmod 600 "$snapshot"

set_release_key() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then sed -i "s/^${key}=.*/${key}=${value}/" "$ENV_FILE"
  else printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"; fi
}
rollback_nexus() {
  local status=$?
  trap - ERR
  echo "Nexus-only rollout failed; restoring only Nexus API/Web. Other services and all volumes remain untouched." >&2
  cp -p -- "$snapshot" "$ENV_FILE"
  export NEXUS_API_RELEASE="$previous_api" NEXUS_WEB_RELEASE="$previous_web"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --no-deps --wait --wait-timeout 300 nexus_api nexus_web || true
  rm -f -- "$snapshot"
  exit "$status"
}
trap rollback_nexus ERR

export NEXUS_API_RELEASE="$RELEASE" NEXUS_WEB_RELEASE="$RELEASE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --no-deps --wait --wait-timeout 300 nexus_api nexus_web
for service in nexus_api nexus_web; do
  id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
  [[ "$status" == healthy || "$status" == running ]] || { echo "$service unhealthy: $status" >&2; exit 1; }
done
set_release_key NEXUS_API_RELEASE "$RELEASE"
set_release_key NEXUS_WEB_RELEASE "$RELEASE"
chmod 600 "$ENV_FILE"
rm -f -- "$snapshot"
trap - ERR
echo "Nexus API/Web deployment $RELEASE healthy. No other service or volume was changed."
