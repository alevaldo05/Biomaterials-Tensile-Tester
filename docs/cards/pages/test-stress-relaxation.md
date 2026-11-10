# Stress Relaxation test page (test-stress-relaxation.html)

Page card. Update it in the same change as the page.

## Purpose
Live Stress Relaxation test (ramp, hold, decay). Shared behavior: see [live test](../features/live-test.md).

## Files
- HTML: `test-stress-relaxation.html` (`live-app` with `data-test="relaxation"`)
- Scripts in order: same as the Uniaxial Tension page: `display-settings.js`, `ui.js` (head), `data/materials.js`, `data/samples.js`, `data/sample-models.js`, `data/device.js`, `data/checklist.js`, `data/text/help.js`, `data/help-tips.js`, `data/terms.js`, `data/tutorials.js`, `graph.js`, `excel-export.js`, `report.js`, `tutorials.js`, `help-coach.js`, `live.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`

## What the user sees
- Same steps as Uniaxial Tension plus Hold displacement, Hold strain, and Hold duration in Test settings
- Auto-stop at end of hold

## Behavior to keep
- Hold-start stress is taken where displacement reaches the hold value; see README "Hold-start stress"
- Every control id used by `live.js` stays (`s-hold`, `s-e0`, `s-holds`, ...)

## Labels that must stay
- Draft badge and hardware draft line
- Safety line: the on-screen STOP button is not an emergency stop

## Depends on
- Features: live test, simulator, USB link, graph engine, downloads, print report

## How to check
- `node scripts/check-site.js`
- Run the simulator through the hold and download the CSV
