# USB link (retired on the website)

Feature card. Update it in the same change as the feature.

## Purpose
RETIRED. The website used to connect to the tester over USB (Web Serial, Chrome only) from its own test pages. The owner retired those pages: the website has no USB connection, never opens a serial port, and never talks to a real tester. Real tests, including the USB connection, are run in the separate tester app (see the [tester-app](tester-app.md) card and `docs/app/`). This card stays so that nothing is rebuilt by mistake.

## Files
- `live-links.js` (now only creates the simulator link: `LiveLinks.create(DEV, isRelax).SimLink`; the shared interface is `open()`, `send(line)`, `close()`, `onLine`, `onClose`)
- `live-sim.js` (the labeled simulator, the only link)
- `data/device.js` (the line format the simulator emits and parses; it is NOT the tester app's protocol, which is in `docs/app/PROTOCOL.md`)

## What the user sees
- Nothing about USB on the website except words saying that USB connection is done in the tester app (New Test page, Help)

## Behavior to keep
- No website page, script, or tutorial opens a serial port or offers a "Connect to tester (USB)" button
- `data/device.js` values stay as they are (`packages/core/reference` reads that file)

## Labels that must stay
- Pages that describe the tester say the hardware connection is untested

## Depends on
- Simulator, live test

## How to check
- `node scripts/check-site.js`; search the pages for `navigator.serial` (there should be none)
