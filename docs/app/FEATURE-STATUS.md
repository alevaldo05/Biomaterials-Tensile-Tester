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

## Simulated

- Everything from the Simulation source. Its signal scaling and curves are made up, and its data is always labeled "Simulated data, not measured" on the screen, in the graph picture, and in every saved file.

## Implemented but untested with real equipment

- USB serial (Web Serial) connection: checked only against a stand-in port in the automated tests. No real board has been connected.
- Real acquisition with a setup file (device profile and calibration records): the loading and the compatibility check are tested with made-up records; no real calibration exists yet.
- The protocol itself has only ever been spoken by the simulator. No firmware exists yet.

## Not built yet

- Device firmware (ESP32 reference, Pico guide), Raspberry Pi service.
- Back end, database, login, admin and user views, saved history, calibration records kept in the database.
- Containers.
- Electron desktop version; a network connection to a Raspberry Pi.
- Printable report, comparison of several files, and tangent line and region guides on the graph (the website has these).

## Unsupported on purpose

- Any control of the tester (start, stop, speed, position, tare on the machine). The app has no such buttons, and the machine-control package answers "unsupported" and transmits nothing.
- An emergency stop. The app has none and does not claim one.

## Unknown, and not assumed anywhere

- The tester's analog output pins, signal scaling, grounding, and any computer-control protocol.
