#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE="${1:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"
LESSONPLAN_ENV_FILE="${LESSONPLAN_ENV_FILE:-/etc/kcs-orbit/lessonplan.env}"

[[ "$RELEASE" =~ ^[0-9a-f]{7,40}$ ]] || { echo "Release must be a Git SHA." >&2; exit 1; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain)" ]] || { echo "Refusing to build a dirty worktree." >&2; exit 1; }
[[ -f "$LESSONPLAN_ENV_FILE" ]] || { echo "Missing $LESSONPLAN_ENV_FILE" >&2; exit 1; }

set -a
. "$LESSONPLAN_ENV_FILE"
set +a

: "${SUPABASE_URL:?Set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY}"

docker build -f "$ROOT_DIR/LessonPlanAPP/server/Dockerfile" -t "kcs/lessonplan-api:$RELEASE" "$ROOT_DIR/LessonPlanAPP/server"
docker build -f "$ROOT_DIR/LessonPlanAPP/Dockerfile.web" \
  --build-arg "VITE_BASE_PATH=/lesson-plan/" \
  --build-arg "VITE_PUBLIC_APP_URL=https://kinshasachristianschool.org/lesson-plan/" \
  --build-arg "VITE_SUPABASE_URL=$SUPABASE_URL" \
  --build-arg "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" \
  --build-arg "VITE_FEDERATED_AUTH_URL=/lesson-plan/api/auth/ecosystem-login" \
  -t "kcs/lessonplan-web:$RELEASE" "$ROOT_DIR/LessonPlanAPP"

printf '%s\n' "$RELEASE"
