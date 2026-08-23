#!/usr/bin/env bash
set -Eeuo pipefail

ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/kcs-orbit/domains.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/compose.yml}"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps --status running

failed=0
for service in orbit_api nexus_api nexus_web edupay_api edupay_web savanex_api savanex_web edusync_api edusync_web; do
  container_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$service")"
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
  if [[ "$status" != "healthy" && "$status" != "running" ]]; then
    echo "$service is not healthy (status: ${status:-missing})" >&2
    failed=1
  fi
done
exit "$failed"
