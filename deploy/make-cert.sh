#!/usr/bin/env bash
# Makes a self-signed certificate for the gateway: deploy/certs/cert.pem and key.pem (both git-ignored).
# Usage:  ./make-cert.sh [--force] name-or-address [more names or addresses...]
#   ./make-cert.sh lab-pc lab-pc.local 192.168.1.20
# Names become DNS: entries and IP addresses become IP: entries. Valid 825 days. Refuses to overwrite unless --force.
# Then:  docker compose up -d --no-deps gateway   (HTTPS is on when both files exist)
set -euo pipefail
cd "$(dirname "$0")"

force=0
names=()
for a in "$@"; do
  case "$a" in
    --force) force=1 ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    -*) echo "Unknown option $a" >&2; exit 2 ;;
    *) names+=("$a") ;;
  esac
done
if [ ${#names[@]} -eq 0 ]; then
  echo "Give at least one name or address, for example: ./make-cert.sh lab-pc lab-pc.local 192.168.1.20" >&2
  exit 2
fi
command -v openssl >/dev/null || { echo "openssl is not installed." >&2; exit 1; }

dir="${CERT_DIR:-certs}"
if [ "$force" -eq 0 ] && { [ -e "$dir/cert.pem" ] || [ -e "$dir/key.pem" ]; }; then
  echo "$dir/cert.pem or key.pem already exists. Use --force to replace them." >&2
  exit 1
fi

san=""
for n in "${names[@]}"; do
  if [[ "$n" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ || "$n" == *:* ]]; then entry="IP:$n"; else entry="DNS:$n"; fi
  san="${san:+$san,}$entry"
done

mkdir -p "$dir"
umask 077
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
  -keyout "$dir/key.pem" -out "$dir/cert.pem" \
  -subj "/CN=${names[0]}" -addext "subjectAltName=$san" \
  -addext "basicConstraints=critical,CA:FALSE" -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" 2>/dev/null
chmod 600 "$dir/key.pem"
chmod 644 "$dir/cert.pem"
echo "Made $dir/cert.pem and $dir/key.pem for: $san (valid 825 days)"
echo "Restart the gateway to use it:  docker compose up -d --no-deps gateway"
