#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="${1:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo "Release must be a full Git SHA." >&2; exit 1; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Refusing to build a dirty worktree." >&2; exit 1; }
: "${NEXUS_API_URL:?Set NEXUS_API_URL}"
ensure_api_path() { local value="${1%/}"; [[ "$value" == */api ]] && printf '%s' "$value" || printf '%s/api' "$value"; }
NEXUS_API_URL="$(ensure_api_path "$NEXUS_API_URL")"

docker build -f "$ROOT_DIR/ops/staging/docker/nexus-api.Dockerfile" -t "kcs/nexus-api:$RELEASE" "$ROOT_DIR"
docker build --build-arg "VITE_API_URL=$NEXUS_API_URL" -t "kcs/nexus-web:$RELEASE" "$ROOT_DIR/KCS Nexus/frontend"
printf '%s\n' "$RELEASE"
