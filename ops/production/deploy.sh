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
previous_nexus_api="$(sed -n 's/^NEXUS_API_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_nexus_web="$(sed -n 's/^NEXUS_WEB_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_edupay_api="$(sed -n 's/^EDUPAY_API_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_edupay_web="$(sed -n 's/^EDUPAY_WEB_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_savanex_api="$(sed -n 's/^SAVANEX_API_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
previous_savanex_web="$(sed -n 's/^SAVANEX_WEB_RELEASE=//p' "$ENV_FILE" | tail -n 1)"
printf '%s\n' "$previous" > "$ROOT_DIR/.previous-production-release"

env_snapshot="$(mktemp "${ENV_FILE}.pre-deploy.XXXXXX")"
cp -p -- "$ENV_FILE" "$env_snapshot"
chmod 600 "$env_snapshot"

set_release_key() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s/^${key}=.*/${key}=${value}/" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

rollback_on_error() {
  exit_code=$?
  trap - ERR
  echo "Deployment failed; restoring the previous application images without touching volumes." >&2
  cp -p -- "$env_snapshot" "$ENV_FILE"
  export KCS_RELEASE="$previous"
  export NEXUS_API_RELEASE="${previous_nexus_api:-$previous}"
  export NEXUS_WEB_RELEASE="${previous_nexus_web:-$previous}"
  export EDUPAY_API_RELEASE="${previous_edupay_api:-$previous}"
  export EDUPAY_WEB_RELEASE="${previous_edupay_web:-$previous}"
  export SAVANEX_API_RELEASE="${previous_savanex_api:-$previous}"
  export SAVANEX_WEB_RELEASE="${previous_savanex_web:-$previous}"
  if [[ "$previous" =~ ^[0-9a-f]{7,40}$ ]]; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --wait --wait-timeout 300 || true
  fi
  rm -f -- "$env_snapshot"
  exit "$exit_code"
}
trap rollback_on_error ERR

export KCS_RELEASE="$RELEASE"
export NEXUS_API_RELEASE="$RELEASE"
export NEXUS_WEB_RELEASE="$RELEASE"
export EDUPAY_API_RELEASE="$RELEASE"
export EDUPAY_WEB_RELEASE="$RELEASE"
export SAVANEX_API_RELEASE="$RELEASE"
export SAVANEX_WEB_RELEASE="$RELEASE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-build --remove-orphans --wait --wait-timeout 300
PRODUCTION_ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" "$ROOT_DIR/ops/production/verify.sh"

set_release_key KCS_RELEASE "$RELEASE"
set_release_key NEXUS_API_RELEASE "$RELEASE"
set_release_key NEXUS_WEB_RELEASE "$RELEASE"
set_release_key EDUPAY_API_RELEASE "$RELEASE"
set_release_key EDUPAY_WEB_RELEASE "$RELEASE"
set_release_key SAVANEX_API_RELEASE "$RELEASE"
set_release_key SAVANEX_WEB_RELEASE "$RELEASE"
chmod 600 "$ENV_FILE"
rm -f -- "$env_snapshot"
trap - ERR
echo "Deployment $RELEASE completed. Volumes were preserved."