# The tester app (lab edition). Build: docker compose build app
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
# The app reads the website's definitions and materials (data/terms.js, data/materials.js) while it is built, and its build
# stamp hashes the shared website files listed in scripts/shared-files.js (data/ and the website scripts in the project's top
# folder) and reads the app's version from apps/desktop/package.json (copied with apps above).
COPY data ./data
COPY scripts/shared-files.js ./scripts/
COPY *.js ./
# The commit shown on the Help screen. Empty (a local build) means the stamp says "unknown".
ARG GITHUB_SHA
# The optional "npm_ca" build secret is only for networks that inspect HTTPS with their own certificate; normally absent.
RUN --mount=type=secret,id=npm_ca,required=false sh -c '[ -f /run/secrets/npm_ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; npm ci --no-audit --no-fund' && npm run build -w @tensile/tester

FROM nginx:1.29-alpine
ARG VERSION=local
LABEL org.opencontainers.image.title="tensile-app" org.opencontainers.image.version="$VERSION"
COPY deploy/app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/tester/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
