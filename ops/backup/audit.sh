#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
CONFIG_FILE="${BACKUP_CONFIG_FILE:-/etc/kcs-orbit/backup.env}"
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
MAX_DISK_PERCENT="${BACKUP_MAX_DISK_PERCENT:-85}"
[[ -r "$CONFIG_FILE" ]] || { echo "CRITICAL: backup configuration is unreadable" >&2; exit 2; }
set -a; source "$CONFIG_FILE"; set +a
: "${BACKUP_ROOT:?BACKUP_ROOT is required}"
latest="$(find "$BACKUP_ROOT/daily" -maxdepth 1 -type f \( -name '*.tar.gz' -o -name '*.tar.gz.age' \) -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)"
[[ -n "$latest" && -f "$latest" ]] || { echo "CRITICAL: no daily backup archive found" >&2; exit 2; }
age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest") ))
(( age_seconds <= MAX_AGE_HOURS * 3600 )) || { echo "CRITICAL: latest backup is older than ${MAX_AGE_HOURS}h" >&2; exit 2; }
disk_percent="$(df -P "$BACKUP_ROOT" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
(( disk_percent <= MAX_DISK_PERCENT )) || { echo "CRITICAL: backup disk usage is ${disk_percent}% (limit ${MAX_DISK_PERCENT}%)" >&2; exit 2; }
if [[ "$latest" == *.age ]]; then
  [[ -n "${BACKUP_AGE_IDENTITY:-}" && -r "${BACKUP_AGE_IDENTITY}" ]] || { echo "WARNING: encrypted archive is fresh but no verification identity is configured"; exit 1; }
  command -v age >/dev/null
  input="$(mktemp --suffix=.tar.gz)"; trap 'rm -f -- "$input"' EXIT
  age -d -i "$BACKUP_AGE_IDENTITY" -o "$input" "$latest"
else
  input="$latest"
fi
tar -tzf "$input" >/dev/null
work="$(mktemp -d)"; trap 'rm -rf -- "$work"; [[ "${input:-}" != "$latest" ]] && rm -f -- "$input"' EXIT
tar -xzf "$input" -C "$work" --no-same-owner
(cd "$work" && sha256sum --check SHA256SUMS >/dev/null)
for dump in "$work"/postgresql/*.dump; do [[ -e "$dump" ]] || continue; pg_restore --list "$dump" >/dev/null; done
if [[ -z "${BACKUP_RCLONE_DESTINATION:-}" ]]; then
  echo "WARNING: local backup verified, but no off-site destination is configured"
  exit 1
fi
command -v rclone >/dev/null
remote="${BACKUP_RCLONE_DESTINATION}/$(basename "$latest")"
rclone lsf "$remote" >/dev/null
echo "OK: fresh archive, checksums, PostgreSQL catalogs, disk capacity and off-site copy verified: $latest"