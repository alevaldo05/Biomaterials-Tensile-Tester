# Live test

Feature card. Update it in the same change as the feature.

## Purpose
Setup, connection, Start/STOP/Tare, recording, auto-stop, and CSV on the two test pages.

## Files
- `live.js`
- `data/device.js`
- `data/checklist.js`
- `ui.js` (the checklist pop-up is the shared Site pop-up; see shared-popups card)
- Test pages `test-uniaxial-tension.html`, `test-stress-relaxation.html`
- CSS: `styles.css` Live test and Load Test pages, test setup in steps, pre-test checklist

## What the user sees
- Steps 1 Specimen, 2 Dimensions, 3 Test settings, 4 Connection, 5 Review before starting
- Start test, STOP, Tare, auto-stop checkbox, status in the tab title
- STOP pinned to the bottom of the window while recording, with "Not an emergency stop."

## Behavior to keep
- Start is unavailable until connected (and until the optional checklist is ticked)
- Esc sends STOP while connected; Esc in the checklist pop-up and in the search does not
- Leave warning while recording or with undownloaded data: the site pop-up for links inside the site (see [leave-popup](leave-popup.md)) and `beforeunload` for closing the tab, reload, and Back
- Material is an optional typed name; crosshead speed is required; Temperature and Environment optional

## Labels that must stay
- "Not an emergency stop."
- Safety line on the test pages
- "Simulated data, not measured"

## Depends on
- Simulator, USB link, graph engine, downloads, print report

## How to check
- Run the simulator from Connect to CSV download; STOP works; Esc sends STOP
