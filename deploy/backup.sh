#!/usr/bin/env bash
# Saves the database to deploy/backups/tester-<date>.dump (run in the deploy folder, with the system running).
# Restore on another computer:  docker compose exec -T db pg_restore -U tester -d tester --clean --if-exists < backups/<file>.dump
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
file="backups/tester-$(date +%Y-%m-%d_%H%M%S).dump"
docker compose exec -T db pg_dump -U tester -d tester -Fc > "$file"
echo "Saved $file ($(wc -c < "$file") bytes)"
