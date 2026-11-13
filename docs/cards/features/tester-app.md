# Tester app and shared packages

Feature card. Update it in the same change as the feature.

## Purpose
The React and TypeScript app for running tests, the packages it shares with the website, the back end, and the containers. Design: [ARCHITECTURE](../../app/ARCHITECTURE.md). The website pages do not need any of it to run.

## Files
- `docs/app/ARCHITECTURE.md`
- `scripts/check-site.js` (leaves the app folders and workspace files alone)
- `scripts/build-site.sh` (leaves them out of the published site)
- Folders `packages/`, `apps/`, `firmware/`, `deploy/`; workspace files `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`, `vitest.config.mjs`
- `packages/core/src/`: the calculations and file formats in TypeScript (key results, data checks, CSV reader and writer, Excel writer, calibration fit, comparison statistics), ported from `graph-core.js`, `live-csv.js`, `excel-export.js`, `calibration.js`, and `compare.js`; `packages/core/test/` holds its checks
- `packages/core/reference/`: runs the website's own calculation scripts on fixed sample and synthetic inputs and compares the results with the saved copy in `fixtures/reference.json`

## What the user sees
- Nothing on the website yet

## Behavior to keep
- The website stays plain files with no build; nothing under `packages/`, `apps/`, `firmware/`, or `deploy/` is published to GitHub Pages
- The app sends no Start, STOP, Tare, speed, or position command to the tester
- Machine control stays "unsupported" (sends nothing) until the tester's interface is verified and reviewed
- `packages/core` gives the same results as the website's scripts (same CSV header lines, so files open on either side); a calculation changed on one side is changed on the other in the same change
- The saved reference numbers change only when a website calculation is changed on purpose (`npm run reference:update`)

## Labels that must stay
- "Simulated data, not measured" on anything from the simulator
- No software button is called an emergency stop

## Depends on
- [graph-engine](graph-engine.md), [downloads](downloads.md), [calibration](calibration.md), [compare](compare.md) (the scripts the reference tests run)

## How to check
- `npm install` once, then `npm test` and `npm run typecheck`
- `node scripts/check-site.js`
