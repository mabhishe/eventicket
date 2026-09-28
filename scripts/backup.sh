#!/bin/sh
# Hourly SQLite backup for EventPass.
# Called by the `backup` sidecar service in docker-compose.yml.
#
# Env:
#   DB_PATH    path to the live database file (default /app/data/app.db)
#   BACKUP_DIR where timestamped backups are written (default /backups)
#
# sqlite3 .backup takes a consistent snapshot even while the app is writing.
# Backups older than RETENTION_DAYS are pruned.
set -eu

DB_PATH="${DB_PATH:-/app/data/app.db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] DB not found at $DB_PATH — skipping (app may not have started yet)"
  exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/app-$STAMP.db"

sqlite3 "$DB_PATH" ".backup main '$DEST'"
echo "[backup] wrote $DEST"

find "$BACKUP_DIR" -maxdepth 1 -name 'app-*.db' -mtime +"$RETENTION_DAYS" -delete
echo "[backup] pruned backups older than $RETENTION_DAYS days"
