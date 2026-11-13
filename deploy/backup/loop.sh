#!/bin/sh
# Scheduled database backups (the `backup` service in compose.yml). Plain sh, runs in the postgres image.
# Every BACKUP_INTERVAL_HOURS it saves the "tester" database on host "db" to /backups as tester-YYYY-MM-DD_HHMMSS.dump
# (the same names deploy/backup.sh makes), writing to a temporary name first and renaming when complete, then keeps only
# the newest BACKUP_KEEP of those files. A failure is logged and tried again at the next interval; this script never exits.
# "sh loop.sh prune" only does the clean-up once (used for checking).
# The password comes from PGPASSWORD (set from POSTGRES_PASSWORD in compose.yml) and is never printed.

DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP:-14}"
HOURS="${BACKUP_INTERVAL_HOURS:-24}"
DELAY="${BACKUP_FIRST_DELAY_SECONDS:-300}"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') backup: $*"; }
is_number() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }

is_number "$KEEP" && [ "$KEEP" -ge 1 ] || { log "BACKUP_KEEP must be a whole number of 1 or more; using 14"; KEEP=14; }
is_number "$HOURS" && [ "$HOURS" -ge 1 ] || { log "BACKUP_INTERVAL_HOURS must be a whole number of 1 or more; using 24"; HOURS=24; }
is_number "$DELAY" || { log "BACKUP_FIRST_DELAY_SECONDS must be a whole number; using 300"; DELAY=300; }

# Delete the oldest backups beyond KEEP. Only files named exactly tester-YYYY-MM-DD_HHMMSS.dump are ever touched.
prune() {
  n=0
  for f in "$DIR"/tester-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9].dump; do
    [ -f "$f" ] && n=$((n + 1))
  done
  extra=$((n - KEEP))
  [ "$extra" -gt 0 ] || return 0
  # The glob expands in name order, which is date order, so the oldest come first.
  for f in "$DIR"/tester-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9].dump; do
    [ "$extra" -gt 0 ] || break
    [ -f "$f" ] || continue
    if rm -f "$f"; then log "removed old backup $(basename "$f")"; else log "could not remove $(basename "$f")"; fi
    extra=$((extra - 1))
  done
}

backup_once() {
  name="tester-$(date +%Y-%m-%d_%H%M%S).dump"
  tmp="$DIR/.$name.part"
  rm -f "$DIR"/.tester-*.dump.part 2>/dev/null
  if pg_dump -h db -U tester -d tester -Fc -f "$tmp" 2>/tmp/pg_dump.err && [ -s "$tmp" ] && mv "$tmp" "$DIR/$name"; then
    log "saved $name ($(wc -c < "$DIR/$name") bytes)"
    prune
  else
    rm -f "$tmp"
    log "FAILED (database not reachable yet?): $(tr '\n' ' ' < /tmp/pg_dump.err | cut -c1-200). Will try again in $HOURS hour(s)."
  fi
}

if [ "$1" = "prune" ]; then prune; exit 0; fi

mkdir -p "$DIR" || log "cannot create $DIR"
log "started: every $HOURS hour(s), keeping the newest $KEEP, first backup in $DELAY second(s)"
sleep "$DELAY"
while true; do
  backup_once
  sleep $((HOURS * 3600))
done
