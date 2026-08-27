#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
ETC_DIR=/etc/kcs-orbit
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
for name in domains.env orbit-api.env nexus-api.env; do
  cp -p "$ETC_DIR/$name" "$ETC_DIR/$name.pre-academy-$stamp"
done
organization_id="$(sed -n 's/^KCS_ORBIT_ORGANIZATION_ID=//p' "$ETC_DIR/nexus-api.env" | tail -n 1)"
[[ -n "$organization_id" ]] || { echo "Missing KCS_ORBIT_ORGANIZATION_ID" >&2; exit 1; }
integration_key="$(openssl rand -hex 32)"
set_key() {
  local file="$1" key="$2" value="$3"
  sed -i "/^${key}=/d" "$file"
  printf '%s=%s\n' "$key" "$value" >> "$file"
}
set_key "$ETC_DIR/orbit-api.env" ACADEMY_INTEGRATION_KEY "$integration_key"
set_key "$ETC_DIR/orbit-api.env" ACADEMY_ORGANIZATION_ID "$organization_id"
set_key "$ETC_DIR/nexus-api.env" ACADEMY_PUBLIC_URL "https://academy.kinshasachristianschool.org"
set_key "$ETC_DIR/nexus-api.env" ACADEMY_INTEGRATION_KEY "$integration_key"
cat > "$ETC_DIR/academy.env" <<EOF
NODE_ENV=production
ORBIT_API_URL=http://orbit_api:4500
ACADEMY_INTEGRATION_KEY=$integration_key
ACADEMY_ORGANIZATION_ID=$organization_id
NEXUS_ACADEMY_LAUNCH_URL=https://kinshasachristianschool.org/login
ACADEMY_DEMO_MODE=false
EOF
set_key "$ETC_DIR/domains.env" ACADEMY_DOMAIN "academy.kinshasachristianschool.org"
chmod 600 "$ETC_DIR/domains.env" "$ETC_DIR/orbit-api.env" "$ETC_DIR/nexus-api.env" "$ETC_DIR/academy.env"
echo "Academy scoped environment configured; previous files saved with suffix $stamp"
