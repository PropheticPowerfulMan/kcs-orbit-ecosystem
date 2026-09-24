#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/kcs-orbit/domains.env}"
RELEASE="${1:-$(cat "$ROOT_DIR/.previous-production-release" 2>/dev/null || true)}"
[[ "$RELEASE" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Usage: rollback.sh <previous-git-sha>" >&2; exit 1; }

set_release_key() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s/^${key}=.*/${key}=${value}/" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

for image in orbit-api nexus-api nexus-web kitchen-api kitchen-web academy edupay-api edupay-web savanex-api savanex-web edusync-api edusync-web; do
  docker image inspect "kcs/$image:$RELEASE" >/dev/null
done

export KCS_RELEASE="$RELEASE"
export ORBIT_API_RELEASE="$RELEASE"
export NEXUS_API_RELEASE="$RELEASE"
export NEXUS_WEB_RELEASE="$RELEASE"
export KITCHEN_API_RELEASE="$RELEASE"
export KITCHEN_WEB_RELEASE="$RELEASE"
export ACADEMY_RELEASE="$RELEASE"
export EDUPAY_API_RELEASE="$RELEASE"
export EDUPAY_WEB_RELEASE="$RELEASE"
docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/ops/production/compose.yml" up -d --no-build --wait --wait-timeout 300
PRODUCTION_ENV_FILE="$ENV_FILE" "$ROOT_DIR/ops/production/verify.sh"
set_release_key KCS_RELEASE "$RELEASE"
set_release_key ORBIT_API_RELEASE "$RELEASE"
set_release_key NEXUS_API_RELEASE "$RELEASE"
set_release_key NEXUS_WEB_RELEASE "$RELEASE"
set_release_key KITCHEN_API_RELEASE "$RELEASE"
set_release_key KITCHEN_WEB_RELEASE "$RELEASE"
set_release_key ACADEMY_RELEASE "$RELEASE"
set_release_key EDUPAY_API_RELEASE "$RELEASE"
set_release_key EDUPAY_WEB_RELEASE "$RELEASE"
chmod 600 "$ENV_FILE"
echo "Application rollback to $RELEASE completed. Database volumes were not modified."