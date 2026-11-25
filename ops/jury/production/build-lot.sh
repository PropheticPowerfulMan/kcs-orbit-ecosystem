#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
RELEASE="${1:-}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo "Full immutable Git SHA required" >&2; exit 1; }
[[ "$(git -C "$ROOT_DIR" rev-parse HEAD)" == "$RELEASE" && -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Build requires the clean exact release checkout" >&2; exit 1; }
: "${NEXUS_API_URL:?}" "${EDUPAY_API_URL:?}" "${EDUPAY_PUBLIC_URL:?}" "${JURY_PUBLIC_URL:?}"
docker build -f "$ROOT_DIR/ops/staging/docker/nexus-api.Dockerfile" -t "kcs/nexus-api:$RELEASE" "$ROOT_DIR"
docker build --build-arg "VITE_API_URL=$NEXUS_API_URL" --build-arg VITE_JURY_ENABLED=true --build-arg "VITE_JURY_PUBLIC_URL=$JURY_PUBLIC_URL" -t "kcs/nexus-web:$RELEASE" "$ROOT_DIR/KCS Nexus/frontend"
docker build -f "$ROOT_DIR/ops/jury/Dockerfile.web" --build-arg VITE_BASE_PATH=/jury/ -t "kcs/jury-web:$RELEASE" "$ROOT_DIR"
docker build -f "$ROOT_DIR/ops/production/docker/edupay-web.Dockerfile" --build-arg "VITE_API_BASE_URL=$EDUPAY_API_URL" --build-arg "VITE_RECEIPT_VERIFICATION_BASE_URL=$EDUPAY_PUBLIC_URL" --build-arg VITE_NEXUS_URL=https://kinshasachristianschool.org --build-arg VITE_BASE_PATH=/ -t "kcs/edupay-web:$RELEASE" "$ROOT_DIR"
docker build -f "$ROOT_DIR/ops/staging/docker/kitchen-web.Dockerfile" --build-arg VITE_API_URL=/kitchen/api --build-arg VITE_BASE_PATH=/kitchen/ -t "kcs/kitchen-web:$RELEASE" "$ROOT_DIR"
