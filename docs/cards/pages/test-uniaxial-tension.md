# Uniaxial Tension test page (test-uniaxial-tension.html)

Page card. Update it in the same change as the page.

## Purpose
Live Uniaxial Tension test with a USB tester (no simulator; the simulator is only on the practice page). Shared behavior: see [live test](../features/live-test.md).

## Files
- HTML: `test-uniaxial-tension.html` (`live-app` with `data-test="uniaxial"`, safety line, a line pointing at the protocol page's equations)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/materials.js`, `data/samples.js`, `data/sample-models.js`, `data/device.js`, `data/checklist.js`, `data/text/help.js`, `data/help-tips.js`, `data/terms.js`, `data/tutorials.js`, `graph-core.js`, `graph.js`, `excel-export.js`, `report.js`, `tutorials.js`, `help-coach.js`, `live-links.js`, `live-checklist.js`, `live-csv.js`, `live-material.js`, `live-shell.js`, `live.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- Page-specific: only the HTML text and the test type

## What the user sees
- Starts empty; setup steps 1 Specimen, 2 Dimensions, 3 Test settings, 4 Connection, 5 Review before starting
- Graph, Readout, Key results, downloads, Print report after a test

## Behavior to keep
- Everything else is shared; see the live test, USB link, graph engine, downloads, and print report cards
- Every control id used by `live.js` stays (`s-mat`, `s-L0`, `c-usb`, `r-start`, `r-stop`, ...)

## Labels that must stay
- Draft badge and "Controller/hardware connection: draft and unvalidated"
- Safety line: the on-screen STOP button is not an emergency stop

## Depends on
- Features: live test, workspace, USB link, graph engine, CSV and Excel downloads, print report

## How to check
- `node scripts/check-site.js`
- Use the practice page (simulator) to check setup, run and CSV download; USB itself is untested
- No "Refused to" messages in the console
