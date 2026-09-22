#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/ops/staging/compose.yml"
ENV_FILE="${STAGING_ENV_FILE:-$ROOT_DIR/ops/staging/.env}"
set -a
source "$ENV_FILE"
set +a
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps --status running
for service in gateway orbit_db orbit_api edupay_db edupay_api edupay_web nexus_db nexus_api nexus_web savanex_db savanex_api savanex_web kitchen_db kitchen_api kitchen_web; do
  container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
  [[ "$status" == "healthy" ]] || { echo "$service is not healthy: $status" >&2; exit 1; }
done
curl --fail --silent --show-error --max-time 15 "https://${STAGING_DOMAIN}/healthz" >/dev/null
curl --fail --silent --show-error --max-time 15 "https://${STAGING_DOMAIN}/api/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "https://${STAGING_DOMAIN}/kitchen/api/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "https://${STAGING_DOMAIN}/kitchen/" >/dev/null
headers="$(curl --fail --silent --show-error --head --max-time 15 "https://${STAGING_DOMAIN}/")"
grep -qi '^X-Robots-Tag:.*noindex' <<<"$headers"
echo "Staging health checks passed."
