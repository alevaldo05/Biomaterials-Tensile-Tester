# Tester app and shared packages

Feature card. Update it in the same change as the feature.

## Purpose
The React and TypeScript app for running tests, the packages it shares with the website, the back end, and the containers. Design: [ARCHITECTURE](../../app/ARCHITECTURE.md). The website pages do not need any of it to run.

## Files
- `docs/app/ARCHITECTURE.md`
- `docs/app/FEATURE-STATUS.md` (what is implemented, simulated, untested, unsupported; update it with every stage)
- `packages/ui/` and `apps/tester/`: the graph and screen pieces, and the app itself (controller, screen, exports, lab and learning editions)
- `docs/app/PROTOCOL.md` (the acquisition protocol; the code in `packages/protocol/` is the reference)
- `packages/acquisition/`, `packages/recording/`, `packages/machine-control/`: sources and transports (simulator, replay, USB serial), the recorder and conversion chain, and the machine-control stub; `packages/recording/test/` holds the acceptance tests
- `scripts/check-site.js` (leaves the app folders and workspace files alone)
- `scripts/build-site.sh` (leaves them out of the published site)
- Folders `packages/`, `apps/`, `firmware/`, `deploy/`; workspace files `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`, `vitest.config.mjs`
- `packages/core/src/`: the calculations and file formats in TypeScript (key results, data checks, CSV reader and writer, Excel writer, calibration fit, comparison statistics), ported from `graph-core.js`, `live-csv.js`, `excel-export.js`, `calibration.js`, and `compare.js`; `packages/core/test/` holds its checks
- `packages/core/reference/`: runs the website's own calculation scripts on fixed sample and synthetic inputs and compares the results with the saved copy in `fixtures/reference.json`

## What the user sees
- Nothing on the website yet
- In the app (`npm run app`): a Setup sidebar with seven steps (Source, Connection, Device, Calibration, Test and specimen, Dimensions, Review; a drawer at 1100 px and narrower), a status bar with the connection state, a toolbar with Zero force, Start recording, Stop recording, then Save data and New test, a measurement strip (a missing value is a dash; uncalibrated values are volts), the graph with three views, and Key results and Session details after a test
- The app has no tester buttons and the line "The crosshead is moved from the tester's own controller. This app only records."

## Behavior to keep
- The website stays plain files with no build; nothing under `packages/`, `apps/`, `firmware/`, or `deploy/` is published to GitHub Pages
- The app sends no Start, STOP, Tare, speed, or position command to the tester
- Machine control stays "unsupported" (sends nothing) until the tester's interface is verified and reviewed
- `packages/core` gives the same results as the website's scripts (same CSV header lines, so files open on either side); a calculation changed on one side is changed on the other in the same change
- Graph, calculation, and recording code never import a device adapter, a transport, or the wire protocol (a test checks this)
- A calibration is used only when its whole signal path matches; without one, values stay in volts and no stress or strain is calculated
- The USB serial transport is untested with real hardware, and the docs say so until it has been tried
- The saved reference numbers change only when a website calculation is changed on purpose (`npm run reference:update`)

## Labels that must stay
- "Simulated data, not measured" on anything from the simulator
- No software button is called an emergency stop

## Depends on
- [graph-engine](graph-engine.md), [downloads](downloads.md), [calibration](calibration.md), [compare](compare.md) (the scripts the reference tests run)

## How to check
- `npm run app:build`, then run a simulated uniaxial and relaxation test in Chrome at 1366, 1280, 1024, 768, and 390 px, and open the saved CSV on the website's Load Test page
- `npm install` once, then `npm test` and `npm run typecheck`
- `node scripts/check-site.js`
