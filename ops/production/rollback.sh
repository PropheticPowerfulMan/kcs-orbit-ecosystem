#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PRODUCTION_ENV_FILE:-/etc/kcs-orbit/domains.env}"
RELEASE="${1:-$(cat "$ROOT_DIR/.previous-production-release" 2>/dev/null || true)}"
[[ "$RELEASE" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Usage: rollback.sh <previous-git-sha>" >&2; exit 1; }

export KCS_RELEASE="$RELEASE"
docker compose --env-file "$ENV_FILE" -f "$ROOT_DIR/ops/production/compose.yml" up -d --no-build --wait --wait-timeout 300
PRODUCTION_ENV_FILE="$ENV_FILE" "$ROOT_DIR/ops/production/verify.sh"
sed -i "s/^KCS_RELEASE=.*/KCS_RELEASE=$RELEASE/" "$ENV_FILE"
echo "Application rollback to $RELEASE completed. Database volumes were not modified."
