# The website (the learning front end), built exactly as GitHub Pages builds it. Build: docker compose build web
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY . .
ARG VERSION=local
RUN bash scripts/build-site.sh /out "$VERSION"

FROM nginx:1.29-alpine
ARG VERSION=local
LABEL org.opencontainers.image.title="tensile-web" org.opencontainers.image.version="$VERSION"
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
