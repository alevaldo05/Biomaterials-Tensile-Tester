#!/bin/sh
# Runs when the gateway container starts (nginx image's /docker-entrypoint.d/). HTTPS is switched on only when both
# certificate files are present; otherwise the gateway is plain HTTP, exactly as before.
set -e
target=/etc/nginx/conf.d/https.conf
if [ -r /etc/nginx/certs/cert.pem ] && [ -r /etc/nginx/certs/key.pem ]; then
  cp /etc/nginx/https.conf.template "$target"
  echo "40-https.sh: certificate found, HTTPS enabled on port 443"
else
  rm -f "$target"
  echo "40-https.sh: no certificate in deploy/certs, HTTP only"
fi
