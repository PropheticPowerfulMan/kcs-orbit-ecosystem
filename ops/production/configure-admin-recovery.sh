#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
env_file=/etc/kcs-orbit/edupay-api.env
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
cp -p "$env_file" "$env_file.pre-admin-recovery-$stamp"
code="KCS-RECOVERY-$(openssl rand -hex 24)"
sed -i '/^ADMIN_RECOVERY_CODE=/d' "$env_file"
printf 'ADMIN_RECOVERY_CODE=%s\n' "$code" >> "$env_file"
printf 'EDUPAY_ADMIN_RECOVERY_CODE=%s\nCREATED_AT_UTC=%s\n' "$code" "$(date -u +%FT%TZ)" > /root/kcs-admin-recovery-code.txt
chmod 600 "$env_file" /root/kcs-admin-recovery-code.txt
echo ADMIN_RECOVERY_CONFIGURED
