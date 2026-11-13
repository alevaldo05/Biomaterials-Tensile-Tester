# Tester app: what works, what is simulated, what is untested, what is unsupported

Updated with each stage. "Checked" means tried in Chrome's engine (Chromium on Linux) only; Safari and a real Windows computer have not been tried.

## Implemented and checked

- The app screen: setup steps (Source, Connection, Device, Calibration, Test and specimen, Dimensions, Review), status bar with the eight states, recording toolbar, measurement strip, graph, key results, session details.
- Simulation source, posing as an ESP32, a Pico, or a Raspberry Pi service. Uniaxial tension and stress relaxation.
- Recorded-data replay from a session file saved by the app (checked in the automated tests, not yet by hand in a browser).
- Recording: every sample with counts, device time, computer time, settings, volts, and the calibrated value; gaps, faults, restarts, and disconnects are written into the session.
- Key results from the shared calculations (the same numbers the website gives for the same data).
- Save data: test CSV (opens on the website's Load Test page), Excel (.xlsx, checked with openpyxl, not Microsoft Excel), graph PNG and SVG, every raw sample as CSV, and a session file for replay.
- Graph: three views, Autoscale, Reset view, Expand, scroll and drag zoom, pan, arrow-key readout, key-result markers with snapping.
- Light and dark theme. Laptop, tablet, and phone widths (1366, 1280, 1024, 768, 390 px) without sideways scrolling.
- Learning edition build: simulation and replay only; the USB serial and machine-control code are not in its files.

## Back end and database

- Implemented and tested against a real PostgreSQL 16: sign-in with argon2id passwords, admin and user roles enforced on the server, saved tests with their full session files, device profiles, calibrations (draft, approved, retired; real equipment only; never overwritten), and a record of changes. See [BACKEND.md](BACKEND.md).
- In the app (lab edition only): Sign in, History (own tests; admins see everyone's), Save to lab database, loading a profile and its approved calibrations in the Calibration step, an Admin page, and View as user.
- Runs in containers ([CONTAINERS.md](CONTAINERS.md)): built and run with Docker here; each service was stopped, restarted, or replaced while the others kept working, and a backup was restored. Not yet tried on your computer, the lab computer, or Docker Desktop on Windows. No HTTPS set up. Backups are by hand (`deploy/backup.sh`), not on a schedule.
- The test image (`deploy/test/Dockerfile`, used by GitHub) could not be built here because this environment cannot reach the Debian package mirror; its steps were run outside a container instead.

## Reference firmware (ESP32 + ADS1115)

- Implemented: `firmware/esp32-ads1115/`. Protocol v1, the six acquisition requests, ADS1115 single-shot conversions one channel after another, raw counts with a microsecond timestamp each, a new boot id per start and a new settings reference per change, lost-sample counting, achieved rate, ADC faults.
- Checked on a computer only: its protocol, acquisition loop, and ADS1115 driver are compiled with a C++ compiler and run against a pretend ADS1115, both in their own unit tests and with the app's real connection and recorder (`packages/recording/test/firmware.test.ts`).
- **Not built for the ESP32 yet** in this environment (the PlatformIO toolchain download was blocked), **never run on a board**, the ADS1115 wiring is untried, and the Windows USB drivers are unchecked.

## Simulated

- Everything from the Simulation source. Its signal scaling and curves are made up, and its data is always labeled "Simulated data, not measured" on the screen, in the graph picture, and in every saved file.

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
