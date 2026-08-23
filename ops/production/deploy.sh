#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/ops/production/compose.yml"
ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/kcs-orbit/domains.env}"
RELEASE="${1:-}"
[[ "$RELEASE" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Usage: deploy.sh <git-sha>" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

for image in orbit-api nexus-api nexus-web edupay-api edupay-web savanex-api savanex-web edusync-api edusync-web; do
  docker image inspect "kcs/$image:$RELEASE" >/dev/null
done

"$ROOT_DIR/ops/backup/pre-deploy-backup.sh"
previous="$(sed -n 's/^KCS_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
printf '%s\n' "$previous" > "$ROOT_DIR/.previous-production-release"

rollback_on_error() {
  exit_code=$?
  trap - ERR
  if [[ "$previous" =~ ^[0-9a-f]{7,40}$ ]]; then
    echo "Deployment failed; restoring application release $previous without touching volumes." >&2
    export KCS_RELEASE="$previous"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --wait --wait-timeout 300 || true
  fi
  exit "$exit_code"
}
trap rollback_on_error ERR

export KCS_RELEASE="$RELEASE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --remove-orphans --wait --wait-timeout 300
PRODUCTION_ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" "$ROOT_DIR/ops/production/verify.sh"

sed -i "s/^KCS_RELEASE=.*/KCS_RELEASE=$RELEASE/" "$ENV_FILE"
trap - ERR
echo "Deployment $RELEASE completed. Volumes were preserved."
