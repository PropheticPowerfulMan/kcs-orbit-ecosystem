#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  echo "Usage: $0 --archive FILE --extract-to EMPTY_DIR [--age-identity FILE]" >&2
}
ARCHIVE=""
DESTINATION=""
AGE_IDENTITY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive) ARCHIVE="${2:-}"; shift 2 ;;
    --extract-to) DESTINATION="${2:-}"; shift 2 ;;
    --age-identity) AGE_IDENTITY="${2:-}"; shift 2 ;;
    *) usage; exit 2 ;;
  esac
done

[[ -f "$ARCHIVE" && -n "$DESTINATION" ]] || { usage; exit 2; }
case "$DESTINATION" in
  /|/home|/root|/var|/srv|/tmp) echo "Refusing unsafe extraction destination" >&2; exit 1 ;;
esac
mkdir -p "$DESTINATION"
[[ -z "$(find "$DESTINATION" -mindepth 1 -maxdepth 1 -print -quit)" ]] || { echo "Extraction destination must be empty" >&2; exit 1; }

INPUT="$ARCHIVE"
TEMP_FILE=""
trap '[[ -n "$TEMP_FILE" ]] && rm -f -- "$TEMP_FILE"' EXIT
if [[ "$ARCHIVE" == *.age ]]; then
  [[ -f "$AGE_IDENTITY" ]] || { echo "--age-identity is required for an encrypted backup" >&2; exit 1; }
  command -v age >/dev/null || { echo "age is required" >&2; exit 1; }
  TEMP_FILE="$(mktemp --suffix=.tar.gz)"
  age -d -i "$AGE_IDENTITY" -o "$TEMP_FILE" "$ARCHIVE"
  INPUT="$TEMP_FILE"
fi

tar -tzf "$INPUT" | awk '
  /^\// || /(^|\/)\.\.($|\/)/ { unsafe=1 }
  END { exit unsafe ? 1 : 0 }
' || { echo "Archive contains an unsafe path" >&2; exit 1; }
tar -xzf "$INPUT" -C "$DESTINATION" --no-same-owner
(cd "$DESTINATION" && sha256sum --check SHA256SUMS)
echo "Backup verified and extracted to: $DESTINATION"
echo "PostgreSQL example: pg_restore --clean --if-exists --no-owner --dbname=TARGET_URL postgresql/orbit.dump"
echo "Stop the affected application before replacing SQLite data or persistent files."
