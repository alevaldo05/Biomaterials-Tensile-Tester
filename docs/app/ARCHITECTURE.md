# Tester app: architecture

Status: **in progress**. This file describes the agreed design. The list of what works today is at the end and is updated with each stage.

## The idea

One repository holds two front ends and one back end:

- the **website** (the plain HTML pages at the repository root): learning, theory, protocols, materials. It is public on GitHub Pages and needs no login, no back end, and no build.
- the **tester app** (`apps/tester`, React and TypeScript): running and recording tests.
- the **back end** (`apps/api`) with a PostgreSQL database: logins, admin and user roles, saved sessions, calibrations, device profiles.

Shared code lives in `packages/` so a change to a calculation or a file format reaches both front ends.

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
| `apps/tester` | The app (lab edition and learning edition) |
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
| Everything else in this file | Planned |

Not verified by anyone yet: the tester's analog output pins, signal scaling, grounding, and any computer-control protocol. Nothing in this repository assumes them.
