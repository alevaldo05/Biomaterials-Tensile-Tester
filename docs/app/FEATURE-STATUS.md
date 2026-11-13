# Tester app: what works, what is simulated, what is untested, what is unsupported

Updated with each stage. "Checked" means tried in Chrome's engine (Chromium on Linux) only; Safari and a real Windows computer have not been tried.

## Implemented and checked

- Home ("Split with tiles"), menu, six separate status indicators, Need help on every screen (help words in `apps/tester/src/help-text.ts`, offline), searchable Help.
- The Test screen: five setup steps (Test and method, Specimen, Connect and identify, Channels and calibration, Review and start), recording toolbar, measurement strip, graph, key results, session details.
- Real acquisition only. The simulator is used only by the automated tests, as a stand-in device; a test checks that the app's source does not import it, and the built app does not contain it.
- Recordings kept on this computer (the browser's IndexedDB) while recording, committed about once a second; an interrupted recording is offered for recovery on Home. Checked in the automated tests (commits, a failed write, recovery) with an in-memory store; the IndexedDB store itself has not been tried with a real recording.
- Load test: session files (rebuilt from their lines, sending nothing to any device) and CSV files; files marked simulated or sample are refused; imports are labeled as unverified. Print report (Draft, light colors on paper; also in Save data after a test) was checked with Chromium's print preview on Load test only; after a test it has not been tried, since that needs a connected device.
- Compare tests (on Load test): up to 12 tests of one type, overlay graph, key results with mean and sample SD, warnings, summary CSV. The summary is covered by automated tests; the screen was tried in Chromium only.
- Test methods: saved setups with revisions, kept on this computer, and shared through the lab server when signed in (admins save, change, and archive; everyone signed in can start a test from one). Checked against a real PostgreSQL 16 in the API tests and in the browser with the API running.
- Recording: every sample with counts, device time, computer time, settings, volts, and the calibrated value; gaps, faults, restarts, and disconnects are written into the session.
- Key results from the shared calculations (the same numbers the website gives for the same data).
- Save data: test CSV (opens on the website's Load Test page), Excel (.xlsx, checked with openpyxl, not Microsoft Excel), graph PNG and SVG, every raw sample as CSV, and a session file for replay.
- Graph: three views, Autoscale, Reset view, Expand, scroll and drag zoom, pan, arrow-key readout, key-result markers with snapping.
- Light and dark theme. Laptop, tablet, and phone widths (1366, 1280, 1024, 768, 390 px) without sideways scrolling.

## Back end and database

- Implemented and tested against a real PostgreSQL 16: sign-in with argon2id passwords, admin and user roles enforced on the server, saved tests with their full session files, device profiles, calibrations (draft, approved, retired; real equipment only; never overwritten), and a record of changes. See [BACKEND.md](BACKEND.md).
- In the app: Sign in, History (own tests; admins see everyone's), Save to lab database, loading a profile and its approved calibrations in the Calibration step, an Admin page, and View as user.
- Runs in containers ([CONTAINERS.md](CONTAINERS.md)): built and run with Docker here; each service was stopped, restarted, or replaced while the others kept working, and a backup was restored. Not yet tried on your computer, the lab computer, or Docker Desktop on Windows. No HTTPS set up. Backups are by hand (`deploy/backup.sh`), not on a schedule.
- The test image (`deploy/test/Dockerfile`, used by GitHub) could not be built here because this environment cannot reach the Debian package mirror; its steps were run outside a container instead.

## Website and app together

- The website's own live test pages are retired. New Test on the website points to the tester app, the practice page, and Load Test. The website has no USB connection any more.
- The app is not published on GitHub Pages. Get the App on the website says "Download not yet available".
- Windows app (`apps/desktop`, Electron): written and its settings checked by tests, but **not yet built or run** (Electron's own files could not be downloaded here). `.github/workflows/desktop.yml` builds an unsigned beta installer into a draft release when started by hand. Its link to the lab server (address in Settings; requests to /api/v1/ sent on by the main process, which holds the sign-in) is tested against the real API without Electron; the Settings box was tried in Chromium with a stand-in for the Windows app. See [WINDOWS-APP.md](WINDOWS-APP.md).
- The app uses the website's definitions and materials (read at build time from `data/terms.js` and `data/materials.js`).

## Reference firmware (ESP32 + ADS1115)

- Implemented: `firmware/esp32-ads1115/`. Protocol v1, the six acquisition requests, ADS1115 single-shot conversions one channel after another, raw counts with a microsecond timestamp each, a new boot id per start and a new settings reference per change, lost-sample counting, achieved rate, ADC faults.
- Checked on a computer only: its protocol, acquisition loop, and ADS1115 driver are compiled with a C++ compiler and run against a pretend ADS1115, both in their own unit tests and with the app's real connection and recorder (`packages/recording/test/firmware.test.ts`).
- **Not built for the ESP32 yet** in this environment (the PlatformIO toolchain download was blocked), **never run on a board**, the ADS1115 wiring is untried, and the Windows USB drivers are unchecked.

## Simulated

- The app has no simulation source. The website's practice page keeps its own labeled simulator.

## Implemented but untested with real equipment

- USB serial (Web Serial) connection: checked only against a stand-in port in the automated tests. No real board has been connected.
- Real acquisition with a setup file (device profile and calibration records): the loading and the compatibility check are tested with made-up records; no real calibration exists yet.
- The protocol has been spoken by the simulator and by the reference firmware's code on a computer, never by a real board.

## Not built yet

- Pico firmware and a Raspberry Pi service (guides only: [GUIDE-pico.md](GUIDE-pico.md), [GUIDE-raspberry-pi-service.md](GUIDE-raspberry-pi-service.md)).
- Electron desktop version; a network connection to a Raspberry Pi.
- Printable report, comparison of several files, and tangent line and region guides on the graph (the website has these).

## Unsupported on purpose

- Any control of the tester (start, stop, speed, position, tare on the machine). The app has no such buttons, and the machine-control package answers "unsupported" and transmits nothing.
- An emergency stop. The app has none and does not claim one.

## Unknown, and not assumed anywhere

- The tester's analog output pins, signal scaling, grounding, and any computer-control protocol.
