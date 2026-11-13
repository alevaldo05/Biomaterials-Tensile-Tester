# Tester app and shared packages

Feature card. Update it in the same change as the feature.

## Purpose
The React and TypeScript app for running tests, the packages it shares with the website, the back end, and the containers. Design: [ARCHITECTURE](../../app/ARCHITECTURE.md). The website pages do not need any of it to run.

## Files
- `docs/app/ARCHITECTURE.md`
- `docs/app/FEATURE-STATUS.md` (what is implemented, simulated, untested, unsupported; update it with every stage)
- `packages/ui/` and `apps/tester/`: the graph and screen pieces, and the app itself (controller, screens, exports)
- `apps/tester/src/Shell.tsx` (menu, status bar, screens, recovery, Need help), `pages/` (Home, Load test, Test methods, Device, Help, Settings, History, Admin), `components/` (status indicators, Need help, graph, results, device panels), `help-text.ts` (the help words, offline), `storage/` (recordings and methods kept on this computer), `load.ts` (opening saved tests), `real.ts` (the only file that opens the USB connection)
- `apps/desktop/` (the Windows app: `main.cjs`, `preload.cjs`, `ui-files.cjs`, `lab-proxy.cjs` (sends /api/v1/ requests on to the lab server set in Settings), `journal-files.cjs` (recordings as files in the app's data folder); `smoke.cjs` (start-up check run by the build workflow on the unpacked program; not shipped); its own `package.json` and lockfile, not in the shared workspace), `.github/workflows/desktop.yml` (builds the unsigned beta installer into a draft release, only when started), `docs/app/WINDOWS-APP.md`
- `apps/tester/test/rehearsal.test.ts`: a stand-in recording (from the test simulator, not real data) goes through a session file, Load test, CSV and Excel exports, and the numbers a report shows, sending nothing to any device; a simulated copy is refused. The matching lab upload of a controller-made file is in `apps/api/test/api.test.ts`. The printing itself (the browser's print window) is not tested.
- `apps/tester/test/helpers.ts`: a stand-in device for tests only; a test checks that nothing in `apps/tester/src` imports the simulator
- `apps/tester/site-data.ts` (the app reads the website's `data/terms.js` and `data/materials.js` at build time). The app is not published on GitHub Pages
- `docs/app/CONTAINERS.md`; `deploy/` (compose file, Dockerfiles, gateway, backups, test image); `.github/workflows/app.yml` (checks; publishes nothing); `.dockerignore`
- `docs/app/BACKEND.md`; `apps/api/` (back end and database migrations); `apps/tester/src/Shell.tsx`, `lab-api.ts`, `pages/` (sign-in, History, Admin, View as user)
- `docs/app/SETUP.md`, `docs/app/GUIDE-pico.md`, `docs/app/GUIDE-raspberry-pi-service.md`
- `firmware/esp32-ads1115/`: reference ESP32 + ADS1115 firmware; board facts only in `include/board_config.h`; `test/host/` runs its portable code on a computer
- `docs/app/PROTOCOL.md` (the acquisition protocol; the code in `packages/protocol/` is the reference)
- `packages/acquisition/`, `packages/recording/`, `packages/machine-control/`: sources and transports (simulator, replay, USB serial), the recorder and conversion chain, and the machine-control stub; `packages/recording/test/` holds the acceptance tests
- `scripts/check-site.js` (leaves the app folders and workspace files alone)
- `scripts/build-site.sh` (leaves them out of the published site)
- Folders `packages/`, `apps/`, `firmware/`, `deploy/`; workspace files `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`, `vitest.config.mjs`
- `packages/core/src/`: the calculations and file formats in TypeScript (key results, data checks, CSV reader and writer, Excel writer, calibration fit, comparison statistics), ported from `graph-core.js`, `live-csv.js`, `excel-export.js`, `calibration.js`, and `compare.js`; `packages/core/test/` holds its checks
- `packages/core/reference/`: runs the website's own calculation scripts on fixed sample and synthetic inputs and compares the results with the saved copy in `fixtures/reference.json`

## What the user sees
- On the website: New Test says "Download not yet available" until the owner publishes a Windows release
- In the app (`npm run app`): menu Home · Test · History (signed in) · Device · Help · Settings (· Admin for admins), and a status bar with six separate indicators (Device, Data, Calibration, Recording, Local storage, Lab server), never one "Ready"
- Home ("Split with tiles"): a New test tile, then Load test, Test methods, Recent tests, Device and calibration, Reports and exports; on the right, interrupted recordings to recover (Open it, Download, Mark as handled) and Recent tests (this computer and the lab server)
- Print report (Draft, white paper, nothing saved) is in Save data after a test, on Load test, and on Compare tests
- After a test: Show regions and Tangent line at cursor under the graph (display only; the tangent's slope is fitted over nearby points)
- Device → Check the calibration with known weights: typed readings or Read force (the calibrated force averaged over 1 s); errors, tolerance flags, fitted line, CSV, Copy, Print; changes nothing (`calibration-check.ts`, `pages/CalibrationCheck.tsx`)
- Load test → Compare tests: up to 12 tests of one test type (files or recent tests); an overlay graph where each test keeps its colour and line style (4 hues checked for colour blindness × 3 line styles, legend inside the picture), key results per test with the mean and sample SD, warnings (different materials, no specimen ID, CSV imports, example dimensions, no data), summary CSV, Copy summary, graph PNG/SVG (`apps/tester/src/compare.ts`, `pages/Compare.tsx`; `SERIES_LIGHT`/`SERIES_DARK`/`seriesStyle` in `packages/ui/src/Graph.tsx`)
- Test: a Setup sidebar with five steps (Test and method, Specimen, Connect and identify, Channels and calibration, Review and start; a drawer at 1100 px and narrower), a toolbar with Software baseline, Start recording, Stop recording, then Save data and New test, a measurement strip (a missing value is a dash; uncalibrated values are volts), the graph (views shown only for data that exists), Key results and Session details
- Load test (session files and CSV; simulated files are refused (a CSV's `Source` note is read with optional quotes and a comma, semicolon, tab, or colon, and the loaded record is checked again); imports are labeled as unverified; Print report opens the browser's print window with a Draft report on white paper, nothing saved), Test methods (saved setups with revisions, on this computer and, when signed in, on the lab server; only admins change lab methods), Device (connection, calibration, a copyable diagnostic summary), Help (searchable, offline), Settings (theme, recordings kept on this computer)
- A Need help button at the bottom right of every screen with help for the current screen or step
- The app has no tester buttons and the line "The crosshead is moved from the tester's own controller. This app only records."

## Behavior to keep
- The website stays plain files with no build; nothing under `packages/`, `apps/`, `firmware/`, or `deploy/` is published to GitHub Pages
- The app sends no Start, STOP, Tare, speed, or position command to the tester
- Machine control stays "unsupported" (sends nothing) until the tester's interface is verified and reviewed
- `packages/core` gives the same results as the website's scripts (same CSV header lines, so files open on either side); a calculation changed on one side is changed on the other in the same change
- Graph, calculation, and recording code never import a device adapter, a transport, or the wire protocol (a test checks this)
- A calibration is used only when its whole signal path matches; without one, values stay in volts and no stress or strain is calculated
- Board pins, the I2C address, and channel wiring live only in the firmware's `board_config.h`, all marked as examples; the firmware sends raw counts only and understands only the six acquisition requests
- Recording never depends on the back end; the website never needs it
- The lab server refuses simulated tests and files with lines a device does not send; it labels each saved test's calibration (lab-approved, not from the lab, none) and shows it in History
- The Windows app keeps context isolation, the sandbox, and no Node in the screens; its preload exposes only a fixed label, the two lab-address calls, and the seven journal calls (all checked in the main process); the lab server is a data connection only (screens always come from the installation) and the sign-in never reaches the screens; it loads only its bundled screens; the installer is a draft release published only by the owner (checked by `apps/desktop/test/desktop.test.ts`); the first installer build succeeded on GitHub (draft `app-v0.2.0-beta.1`) but has never been installed on a Windows computer (first-install checklist in `docs/app/WINDOWS-APP.md`); code signing is not planned
- A comparison never invents a value: a missing result shows a dash and is left out of the mean and SD; the offset yield is labelled an estimate
- The app has real acquisition and replay of saved sessions only: no simulator in its source or build
- While recording, samples are committed to this computer's storage about once a second; an unfinished recording is offered for recovery on Home; a failed save is shown and recording continues in memory
- A software baseline is not a machine tare and not a calibration, and the screen says so
- Each container is replaceable on its own: no service waits for another, and the gateway looks addresses up per request
- `.env` and backups are never committed; images are not published without the owner's okay
- Roles are checked on the server; View as user changes only the screen
- Calibrations are stored only for real equipment, are never overwritten, and are used only once approved; migrations only add
- The serial speed is 921600 in both `board_config.h` and `apps/tester/src/real.ts`
- The USB serial transport is untested with real hardware, and the docs say so until it has been tried
- The saved reference numbers change only when a website calculation is changed on purpose (`npm run reference:update`)

## Labels that must stay
- "Simulated data, not measured" on anything from the simulator (in the app, only in tests)
- Speed and hold time are labeled as instructions for the operator; the app does not set them
- No software button is called an emergency stop

## Depends on
- [graph-engine](graph-engine.md), [downloads](downloads.md), [calibration](calibration.md), [compare](compare.md) (the scripts the reference tests run)

## How to check
- `bash firmware/esp32-ads1115/test/host/build-and-test.sh` (needs a C++ compiler); `pio run -e esp32dev` in `firmware/esp32-ads1115` (needs PlatformIO and its download hosts); the `firmware-build` job in `.github/workflows/app.yml` runs it on GitHub (compile only)
- `npm run app:build`, then open each screen in Chrome at 1366, 1280, 1024, 768, and 390 px, light and dark; recording, recovery, and Load test are covered by `apps/tester/test/` with a stand-in device
- `npm install` once, then `npm test` and `npm run typecheck`
- `node scripts/check-site.js`
