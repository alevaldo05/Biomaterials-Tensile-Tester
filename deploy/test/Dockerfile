# Runs every check of the app workspace in a clean container: type checks, all tests (the API against a real
# PostgreSQL, the firmware code with a C++ compiler), and the website checks. Used by .github/workflows/app.yml.
#   docker build -f deploy/test/Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends postgresql g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN --mount=type=secret,id=npm_ca,required=false sh -c '[ -f /run/secrets/npm_ca ] && export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; npm ci --no-audit --no-fund'
RUN npm run typecheck && npm test && node scripts/check-site.js && npm run build -w @tensile/tester && npm run build -w @tensile/api
