# Live test

Feature card. Update it in the same change as the feature.

## Purpose
Setup, connection to the simulator, Start/STOP/Tare, recording, auto-stop, and CSV on the practice page. (The website's own live test pages and USB connection were retired; real tests are run in the tester app.)

## Files
- `live.js` (the page: setup form, review, guided steps, run control, readings)
- `live-links.js` (makes the simulator link; the simulator is in `live-sim.js`), `live-checklist.js` (pre-test checklist pop-up), `live-csv.js` (CSV text); load before `live.js`
- `data/device.js` (the simulator's line format; not the tester app's protocol)
- `data/checklist.js`
- `ui.js` (the checklist pop-up is the shared Site pop-up; see shared-popups card)
- Page `practice.html` (the only page that loads `live.js`)
- CSS: `css/live.css` (Live test and Load Test pages), `css/test-setup.css` (test setup in steps), `css/checklist.css` (pre-test checklist)

## What the user sees
- Steps 1 Specimen, 2 Dimensions, 3 Test settings, 4 Connection, 5 Review before starting
- Start recording, End recording (stops saving only; sends no stop command), STOP tester, Tare, auto-stop checkbox, status in the tab title; the layout is in the [workspace](workspace.md) card
- STOP pinned to the bottom of the window while recording, with "Not an emergency stop."

## Behavior to keep
- The setup is shown one step at a time by default (see [guided-steps](guided-steps.md)); every id listed here still exists
- Setup labels (Gauge length, Area, Crosshead speed, Hold displacement, Hold strain) show a definition tip (see [hover-definitions](hover-definitions.md))
- Start is unavailable until the simulator is used (and until the optional checklist is ticked)
- Esc sends STOP while connected (to the simulator); Esc in the checklist pop-up and in the search does not
- Leave warning while recording or with undownloaded data: the site pop-up for links inside the site (see [leave-popup](leave-popup.md)) and `beforeunload` for closing the tab, reload, and Back
- Material is required (a typed name or a ready choice); crosshead speed is required; Temperature and Environment optional

## Labels that must stay
- "Not an emergency stop."
- Safety line on the practice page
- "Simulated data, not measured"

## Depends on
- Simulator, graph engine, downloads, print report (the [usb-link](usb-link.md) card is retired)

## How to check
- On the practice page, run the simulator from Use simulator to CSV download for both kinds of test; STOP works; Esc sends STOP
