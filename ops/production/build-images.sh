#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="${1:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
[[ "$RELEASE" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Release must be a Git SHA." >&2; exit 1; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Refusing to build a dirty worktree." >&2; exit 1; }

: "${NEXUS_API_URL:?Set NEXUS_API_URL}"
: "${NEXUS_DOMAIN:?Set NEXUS_DOMAIN}"
: "${EDUPAY_API_URL:?Set EDUPAY_API_URL}"
: "${EDUPAY_PUBLIC_URL:?Set EDUPAY_PUBLIC_URL}"
: "${SAVANEX_API_URL:?Set SAVANEX_API_URL}"
: "${EDUSYNC_API_URL:?Set EDUSYNC_API_URL}"

docker build -f "$ROOT_DIR/kcs-orbit-api/Dockerfile" -t "kcs/orbit-api:$RELEASE" "$ROOT_DIR"
docker build -f "$ROOT_DIR/ops/staging/docker/nexus-api.Dockerfile" -t "kcs/nexus-api:$RELEASE" "$ROOT_DIR"
docker build --build-arg "VITE_API_URL=$NEXUS_API_URL" -t "kcs/nexus-web:$RELEASE" "$ROOT_DIR/KCS Nexus/frontend"
docker build -f "$ROOT_DIR/ops/production/docker/edupay-api.Dockerfile" -t "kcs/edupay-api:$RELEASE" "$ROOT_DIR"
docker build -f "$ROOT_DIR/ops/production/docker/edupay-web.Dockerfile" --build-arg "VITE_API_BASE_URL=$EDUPAY_API_URL" --build-arg "VITE_RECEIPT_VERIFICATION_BASE_URL=$EDUPAY_PUBLIC_URL" --build-arg "VITE_NEXUS_URL=https://$NEXUS_DOMAIN" --build-arg "VITE_BASE_PATH=/" -t "kcs/edupay-web:$RELEASE" "$ROOT_DIR"
docker build -t "kcs/savanex-api:$RELEASE" "$ROOT_DIR/SAVANEX Project/backend"
docker build --build-arg "VITE_API_URL=$SAVANEX_API_URL" --build-arg "VITE_NEXUS_URL=https://$NEXUS_DOMAIN" --build-arg "VITE_BASE_PATH=/" -t "kcs/savanex-web:$RELEASE" "$ROOT_DIR/SAVANEX Project/frontend"
docker build -t "kcs/edusync-api:$RELEASE" "$ROOT_DIR/EduSync AI/backend"
docker build --build-arg "VITE_API_URL=$EDUSYNC_API_URL" -t "kcs/edusync-web:$RELEASE" "$ROOT_DIR/EduSync AI/frontend"

printf '%s\n' "$RELEASE"
