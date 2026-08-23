#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_CONFIG_FILE="${BACKUP_CONFIG_FILE:-/etc/kcs-ecosystem/backup.env}" "$SCRIPT_DIR/backup.sh"
echo "Pre-deployment backup succeeded. Deployment may continue."
