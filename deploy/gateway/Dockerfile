FROM nginx:1.29-alpine
ARG VERSION=local
LABEL org.opencontainers.image.title="tensile-gateway" org.opencontainers.image.version="$VERSION"
COPY deploy/gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/gateway/gateway-routes.conf /etc/nginx/gateway-routes.conf
COPY deploy/gateway/https.conf.template /etc/nginx/https.conf.template
# Switches HTTPS on at start-up when /etc/nginx/certs/cert.pem and key.pem are mounted.
COPY --chmod=755 deploy/gateway/40-https.sh /docker-entrypoint.d/40-https.sh
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/app/ 2>/dev/null; nginx -t >/dev/null 2>&1 || exit 1
