#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="${1:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo "Release must be a full Git SHA." >&2; exit 1; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Refusing to build a dirty worktree." >&2; exit 1; }

docker build -f "$ROOT_DIR/ops/staging/docker/kitchen-api.Dockerfile" -t "kcs/kitchen-api:$RELEASE" "$ROOT_DIR"
docker build -f "$ROOT_DIR/ops/staging/docker/kitchen-web.Dockerfile" --build-arg "VITE_API_URL=/kitchen/api" --build-arg "VITE_BASE_PATH=/kitchen/" -t "kcs/kitchen-web:$RELEASE" "$ROOT_DIR"
printf '%s\n' "$RELEASE"
