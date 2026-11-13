# The back end. Build: docker compose build api
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
# The optional "npm_ca" build secret is only for networks that inspect HTTPS with their own certificate; normally absent.
RUN --mount=type=secret,id=npm_ca,required=false sh -c '[ -f /run/secrets/npm_ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; npm ci --no-audit --no-fund' && npm run build -w @tensile/api
# Only what the server needs at run time (the shared packages are already inside the bundle).
RUN --mount=type=secret,id=npm_ca,required=false sh -c 'rm -rf node_modules; [ -f /run/secrets/npm_ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; npm ci --omit=dev --no-audit --no-fund -w @tensile/api'

FROM node:22-bookworm-slim
ARG VERSION=local
LABEL org.opencontainers.image.title="tensile-api" org.opencontainers.image.version="$VERSION"
ENV NODE_ENV=production PORT=3000
WORKDIR /srv
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/apps/api/dist ./dist
COPY --from=build /src/apps/api/migrations ./migrations
COPY deploy/api/healthcheck.mjs ./healthcheck.mjs
USER node
EXPOSE 3000
# Alive when the API answers at all; whether the database is up is reported by /api/v1/health itself.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "dist/server.js"]
