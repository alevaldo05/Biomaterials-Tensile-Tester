# Tester app: architecture

Status: **in progress**. This file describes the agreed design. The list of what works today is at the end and is updated with each stage.

## The idea

One repository holds two front ends and one back end:

- the **website** (the plain HTML pages at the repository root): learning, theory, protocols, materials. It is public on GitHub Pages and needs no login, no back end, and no build.
- the **tester app** (`apps/tester`, React and TypeScript): running and recording tests.
- the **back end** (`apps/api`) with a PostgreSQL database: logins, admin and user roles, saved sessions, calibrations, device profiles.

Shared code lives in `packages/` so a change to a calculation or a file format reaches both front ends. How the two stay the same:

- **Calculations and files.** `packages/core` is checked on every run against the website's own scripts (`packages/core/reference`). If one side's numbers or CSV change without the other, `npm test` fails.
- **Words.** The app reads the website's definitions (`data/terms.js`) and materials (`data/materials.js`) when it is built (`apps/tester/site-data.ts`), so editing those files changes both.
- **Places.** GitHub Pages carries the website only (New Test says "Download not yet available" until a Windows release exists); on the lab computer the gateway serves the website at `/` and the full app at `/app/`. The app's help links point one folder up when it is served at `/app/`, and to the public website otherwise.
- **Tests.** Live tests run only in the app. The website's own test pages were retired; its practice page (simulator) and Load Test remain, and CSV files from the app open in Load Test.

The app is built so that changing the acquisition board, the ADC, or the connection changes only the device-side software, a device adapter, and settings. The graph, forms, recording, and exports do not change.

## Layers

```
transport (Web Serial | simulator | file replay)      moves bytes or messages
  -> framer and runtime validation                    partial lines, oversize lines, bad JSON, versions
  -> device adapter                                   device messages -> standard records
  -> conversion chain                                 ADC counts -> volts -> conditioned signal -> physical value (calibration)
  -> recorder                                         session, gaps, faults, provenance; independent of the graph
  -> experiment logic                                 stress, strain, key results, exports
  -> React interface                                  connection steps, workspace, graph

machine control                                       a separate interface; today every request is "unsupported" and sends nothing
```

Rules that hold everywhere:

- Board names, pin numbers, ADC registers, and machine command text never appear in React components.
- Acquisition and machine control are separate. Reading measurements does not create a way to move the crosshead.
- The app sends no Start, STOP, Tare, speed, or position command to the tester. The original machine controller moves the crosshead.
- A missing value is shown as unavailable, never as zero. Without a compatible calibration a value is shown in volts and labeled uncalibrated, and stress and strain are not calculated.
- Recording does not depend on the back end or on the graph. If the back end is down, a test can still be recorded and downloaded.

## Folders

| Folder | Holds |
|---|---|
| `packages/core` | Calculations, CSV and Excel files, calibration maths (ported from the website's scripts and checked against them) |
| `packages/protocol` | The acquisition protocol: message shapes, runtime checks, line framer |
| `packages/acquisition` | The common acquisition interface, transports, device adapters, connection states |
| `packages/machine-control` | The machine-control interface and its only implementation, "unsupported" |
| `packages/recording` | The recorder, the conversion chain, calibration compatibility |
| `packages/ui` | Shared React components |
| `apps/desktop` | The Windows app (Electron): the tester screens bundled in a locked-down window, with USB serial. Its own lockfile, outside the shared workspace |
| `apps/tester` | The app (real acquisition and saved-session replay; the simulator appears only in its tests) |
| `apps/api` | The back end |
| `firmware/` | Reference device-side software and guides |
| `deploy/` | Container files |

## Containers

`gateway` (routes `/` to the website, `/app` to the app, `/api` to the back end), `web`, `app`, `api`, `db`. Each has its own image and version and can be replaced by itself. USB stays in the browser, so no container needs the tester.

## What works today

| Part | State |
|---|---|
| Workspace, TypeScript, test runner | Implemented |
| Reference tests of the website's calculations (`packages/core/reference`) | Implemented |
| `packages/core`: stress, strain, modulus fit, offset yield, relaxation results, data checks, CSV reader and writer, Excel writer, calibration fit, comparison statistics | Implemented; every result is compared with the website's own scripts on the same inputs (CSV and Excel files byte for byte) |
| `packages/protocol`: protocol version 1 ([PROTOCOL](PROTOCOL.md)), run-time checks of every received line, line framer | Implemented |
| `packages/acquisition`: common source interface, connection states and plain-language diagnostics, the protocol adapter | Implemented |
| Simulator (a pretend device speaking the real protocol; can pose as different device types and produce faults on demand) | Implemented; its data is simulated, not measured |
| Recorded-data replay | Implemented |
| USB serial (Web Serial) transport | Implemented and checked with a stand-in port only; **untested with real hardware** |
| `packages/recording`: conversion chain, calibration compatibility, recorder (raw and converted values, both timestamps, gaps, faults), session to test record | Implemented |
| `packages/machine-control`: "unsupported", transmits nothing | Implemented (as a stub, on purpose) |
| ESP32 reference firmware (shared code in `firmware/common`, board folder `firmware/esp32-ads1115`) | Implemented; tested on a computer with a pretend ADS1115 only, never on a board ([SETUP](SETUP.md)) |
| Pico firmware, Raspberry Pi service | Planned; guides only |
| Electron, a network transport to a Raspberry Pi | Planned |
| `packages/ui` and `apps/tester`: the app screens, graph, exports, local recording and recovery | Implemented; details in [FEATURE-STATUS](FEATURE-STATUS.md) |
| `apps/api`: back end and PostgreSQL database, sign-in, admin and user roles, saved tests, device profiles, calibrations, record of changes | Implemented; tested against a real PostgreSQL ([BACKEND](BACKEND.md)) |
| Signing in, History, Admin, and View as user in the app | Implemented |
| The website's definitions and materials used by the app (read at build time) | Implemented |
| Containers (`deploy/`): gateway, website, app, API, database, each replaceable on its own | Implemented; built and run with Docker here ([CONTAINERS](CONTAINERS.md)) |

Two things `packages/core` does differently from the website on purpose (the website pages are unchanged):

- The comparison numbers can include the opt-in offset yield (`keyNumbers(..., { includeOffsetYield: true })`). On the website, Compare leaves it out.
- A loaded CSV with no known material no longer turns the 0.2% yield on; only steel does. The website's rule is still available (`websiteYieldRule`).

Not verified by anyone yet: the tester's analog output pins, signal scaling, grounding, and any computer-control protocol. Nothing in this repository assumes them.
