#!/usr/bin/env bash
# Builds the folder that gets published. Usage: bash scripts/build-site.sh <output folder> <commit> [run id]
# It only copies; the files in the repository are not changed.
# With APP_DIST=<folder> it also copies an already built tester app (the learning edition) into <output folder>/app/.
set -euo pipefail

out="${1:?output folder}"
sha="${2:?commit hash}"
run="${3:-local}"
short="${sha:0:7}"

rm -rf "$out"
mkdir -p "$out"

# Copy the site, leaving out Git files, the workflow, scripts, and documents (*.md and docs/),
# and the tester app's folders and workspace files (the same names scripts/check-site.js leaves alone).
tar -cf - \
  --exclude='./.git' --exclude='./.github' --exclude='./scripts' --exclude='./docs' \
  --exclude='*.md' --exclude='./_site' --exclude='./.gitignore' \
  --exclude='./node_modules' --exclude='./packages' --exclude='./apps' --exclude='./firmware' --exclude='./deploy' \
  --exclude='./package.json' --exclude='./package-lock.json' --exclude='./tsconfig.json' --exclude='./tsconfig.*.json' \
  --exclude='./vitest.config.mjs' --exclude='./.dockerignore' \
  . | tar -xf - -C "$out"

# The tester app's learning edition (simulation and replay only; no USB, no sign-in), built beforehand by the workflow.
# Its file names already carry a content hash, so they need no ?v= stamp.
if [ -n "${APP_DIST:-}" ]; then
  if [ ! -f "$APP_DIST/index.html" ]; then echo "APP_DIST ($APP_DIST) has no index.html" >&2; exit 1; fi
  mkdir -p "$out/app"
  cp -R "$APP_DIST"/. "$out/app/"
fi

# Add ?v=<commit> to local .css and .js links so browsers fetch new files after each deploy.
# Matches only relative links such as src="graph.js" or href="styles.css" (no http:, no #, no existing ?).
for f in "$out"/*.html; do
  sed -E -i "s/((src|href)=\"[^\"#?:]+\.(css|js))\"/\1?v=${short}\"/g" "$f"
done

# version.json: open <site>/version.json to see which commit is live.
# "version" is the release number the pages show in their footer (build-number.js); change it there and here together.
printf '{ "version": "2.0", "commit": "%s", "short": "%s", "run": "%s", "built": "%s" }\n' \
  "$sha" "$short" "$run" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$out/version.json"

echo "Built $out for commit $short"
