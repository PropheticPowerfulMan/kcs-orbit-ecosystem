#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONFIG_FILE="${BACKUP_CONFIG_FILE:-/etc/kcs-orbit/backup.env}"
[[ -r "$CONFIG_FILE" ]] || { echo "Backup configuration is not readable: $CONFIG_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

: "${BACKUP_ROOT:?BACKUP_ROOT is required}"
case "$BACKUP_ROOT" in
  /|/home|/root|/var|/var/backups) echo "Refusing unsafe BACKUP_ROOT: $BACKUP_ROOT" >&2; exit 1 ;;
esac
for tool in pg_restore sha256sum tar flock; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done

mkdir -p "$BACKUP_ROOT" "$BACKUP_ROOT/daily" "$BACKUP_ROOT/weekly" "$BACKUP_ROOT/monthly"
exec 9>"$BACKUP_ROOT/.backup.lock"
flock -n 9 || { echo "Another ecosystem backup is already running" >&2; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HOST="$(hostname -s 2>/dev/null || hostname)"
WORK_DIR="$(mktemp -d "$BACKUP_ROOT/.in-progress-${STAMP}-XXXXXX")"
trap 'rm -rf -- "$WORK_DIR"' EXIT
mkdir -p "$WORK_DIR/postgresql" "$WORK_DIR/sqlite" "$WORK_DIR/files"
log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

dump_postgres() {
  local name="$1" url="$2"
  [[ -n "$url" ]] || return 0
  log "Backing up PostgreSQL database: $name"
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$WORK_DIR/postgresql/${name}.dump" "$url"
  pg_restore --list "$WORK_DIR/postgresql/${name}.dump" >/dev/null
}
dump_postgres_container() {
  local name="$1" container="$2"
  [[ -n "$container" ]] || return 0
  command -v docker >/dev/null || { echo "docker is required for container database backups" >&2; exit 1; }
  docker inspect "$container" >/dev/null 2>&1 || { echo "Database container is missing: $container" >&2; exit 1; }
  log "Backing up PostgreSQL container: $name"
  docker exec "$container" sh -c 'exec pg_dump --format=custom --compress=6 --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' > "$WORK_DIR/postgresql/${name}.dump"
  pg_restore --list "$WORK_DIR/postgresql/${name}.dump" >/dev/null
}
if [[ -n "${ORBIT_DATABASE_URL:-}${NEXUS_DATABASE_URL:-}${EDUPAY_DATABASE_URL:-}${SAVANEX_DATABASE_URL:-}${EDUSYNC_DATABASE_URL:-}" ]]; then
  command -v pg_dump >/dev/null || { echo "pg_dump is required for URL database backups" >&2; exit 1; }
fi
dump_postgres orbit "${ORBIT_DATABASE_URL:-}"
dump_postgres nexus "${NEXUS_DATABASE_URL:-}"
dump_postgres edupay "${EDUPAY_DATABASE_URL:-}"
dump_postgres savanex "${SAVANEX_DATABASE_URL:-}"
dump_postgres edusync "${EDUSYNC_DATABASE_URL:-}"
[[ -n "${ORBIT_DATABASE_URL:-}" ]] || dump_postgres_container orbit "${ORBIT_DATABASE_CONTAINER:-}"
[[ -n "${NEXUS_DATABASE_URL:-}" ]] || dump_postgres_container nexus "${NEXUS_DATABASE_CONTAINER:-}"
[[ -n "${EDUPAY_DATABASE_URL:-}" ]] || dump_postgres_container edupay "${EDUPAY_DATABASE_CONTAINER:-}"
[[ -n "${SAVANEX_DATABASE_URL:-}" ]] || dump_postgres_container savanex "${SAVANEX_DATABASE_CONTAINER:-}"
[[ -n "${EDUSYNC_DATABASE_URL:-}" ]] || dump_postgres_container edusync "${EDUSYNC_DATABASE_CONTAINER:-}"

if [[ -n "${SQLITE_DATABASES:-}" ]]; then
  command -v sqlite3 >/dev/null || { echo "sqlite3 is required while SQLITE_DATABASES is set" >&2; exit 1; }
  read -r -a sqlite_paths <<< "$SQLITE_DATABASES"
  for database in "${sqlite_paths[@]}"; do
    if [[ -f "$database" ]]; then
      safe_name="$(printf '%s' "$database" | sed 's|^/||; s|/|__|g')"
      log "Backing up SQLite database: $database"
      sqlite3 "$database" ".timeout 10000" ".backup '$WORK_DIR/sqlite/${safe_name}'"
      sqlite3 "$WORK_DIR/sqlite/${safe_name}" 'PRAGMA integrity_check;' | grep -qx 'ok'
    else
      log "SQLite database missing, skipped: $database"
    fi
  done
fi

if [[ -n "${PERSISTENT_PATHS:-}" ]]; then
  read -r -a persistent_paths <<< "$PERSISTENT_PATHS"
  for path in "${persistent_paths[@]}"; do
    if [[ -e "$path" ]]; then
      safe_name="$(printf '%s' "$path" | sed 's|^/||; s|/|__|g')"
      log "Backing up persistent path: $path"
      tar --numeric-owner -C / -czf "$WORK_DIR/files/${safe_name}.tar.gz" "${path#/}"
    else
      log "Persistent path missing, skipped: $path"
    fi
  done
fi

find "$WORK_DIR/postgresql" "$WORK_DIR/sqlite" "$WORK_DIR/files" -type f -print -quit | grep -q . || {
  echo "No database or persistent file was backed up; refusing to create an empty archive" >&2
  exit 1
}

cat > "$WORK_DIR/metadata.txt" <<EOF
format_version=1
created_at_utc=$(date -u +%FT%TZ)
hostname=$HOST
EOF
(cd "$WORK_DIR" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

ARCHIVE="$BACKUP_ROOT/daily/kcs-orbit-${HOST}-${STAMP}.tar.gz"
tar -C "$WORK_DIR" -czf "$ARCHIVE" .
tar -tzf "$ARCHIVE" >/dev/null

if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  command -v age >/dev/null || { echo "age is required while BACKUP_AGE_RECIPIENT is set" >&2; exit 1; }
  age -r "$BACKUP_AGE_RECIPIENT" -o "${ARCHIVE}.age" "$ARCHIVE"
  rm -f -- "$ARCHIVE"
  ARCHIVE="${ARCHIVE}.age"
fi

if [[ "$(date -u +%u)" == "7" ]]; then cp -p -- "$ARCHIVE" "$BACKUP_ROOT/weekly/"; fi
if [[ "$(date -u +%d)" == "01" ]]; then cp -p -- "$ARCHIVE" "$BACKUP_ROOT/monthly/"; fi
find "$BACKUP_ROOT/daily" -maxdepth 1 -type f -mtime "+${BACKUP_RETENTION_DAYS:-7}" -delete
find "$BACKUP_ROOT/weekly" -maxdepth 1 -type f -mtime "+${BACKUP_RETENTION_WEEKS:-28}" -delete
find "$BACKUP_ROOT/monthly" -maxdepth 1 -type f -mtime "+${BACKUP_RETENTION_MONTHS:-365}" -delete

if [[ -n "${BACKUP_RCLONE_DESTINATION:-}" ]]; then
  command -v rclone >/dev/null || { echo "rclone is required while BACKUP_RCLONE_DESTINATION is set" >&2; exit 1; }
  log "Copying backup off site"
  rclone copyto "$ARCHIVE" "${BACKUP_RCLONE_DESTINATION}/$(basename "$ARCHIVE")" --checksum
fi
log "Backup completed and verified: $ARCHIVE"
