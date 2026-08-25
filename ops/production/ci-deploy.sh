#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ACTION="${1:-}"
RELEASE="${2:-}"
CONFIRMATION="${3:-}"

[[ "$ACTION" == "deploy" || "$ACTION" == "rollback" ]] || {
  echo "Usage: ci-deploy.sh <deploy|rollback> <git-sha> <confirmation>" >&2
  exit 1
}
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo "A full 40-character Git SHA is required." >&2; exit 1; }

exec 9>/var/lock/kcs-orbit-deploy.lock
flock -n 9 || { echo "Another production deployment is already running." >&2; exit 1; }

cd "$ROOT_DIR"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || {
  echo "Refusing to deploy from a dirty tracked worktree." >&2
  exit 1
}

git fetch --quiet origin main
git merge-base --is-ancestor "$RELEASE" origin/main || {
  echo "Release is not part of origin/main." >&2
  exit 1
}

if [[ "$ACTION" == "rollback" ]]; then
  [[ "$CONFIRMATION" == "ROLLBACK_PRODUCTION" ]] || { echo "Rollback confirmation is invalid." >&2; exit 1; }
  exec "$ROOT_DIR/ops/production/rollback.sh" "$RELEASE"
fi

[[ "$CONFIRMATION" == "DEPLOY_PRODUCTION" ]] || { echo "Deployment confirmation is invalid." >&2; exit 1; }
[[ "$(git rev-parse HEAD)" == "$RELEASE" ]] || {
  echo "The VPS checkout must exactly match the requested release." >&2
  exit 1
}

set -a
# shellcheck disable=SC1091
source /etc/kcs-orbit/domains.env
set +a
export NEXUS_API_URL="https://${NEXUS_API_DOMAIN}/api"
export EDUPAY_API_URL="https://${EDUPAY_API_DOMAIN}"
export EDUPAY_PUBLIC_URL="https://${EDUPAY_DOMAIN}"
export SAVANEX_API_URL="https://${SAVANEX_API_DOMAIN}/api"
export EDUSYNC_API_URL="https://${EDUSYNC_API_DOMAIN}"

"$ROOT_DIR/ops/production/build-images.sh" "$RELEASE"
"$ROOT_DIR/ops/production/deploy.sh" "$RELEASE"