# Calibration (calibration.html)

Page card. Update it in the same change as the page.

## Purpose
Compare force readings typed by hand with known masses. See [calibration](../features/calibration.md).

## Files
- HTML: `calibration.html` (ids `cal-app`, `cal-results`, `how-section`, `limits-section`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/terms.js`, `data/tutorials.js`, `data/text/help.js`, `data/help-tips.js`, `report.js`, `tutorials.js`, `help-coach.js`, `calibration.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`

## What the user sees
- Enter points table, fit and errors, chart, CSV record, Copy results, Print report
- How to calibrate (draft) and What this page does and does not do

## Behavior to keep
- Changes no reading anywhere, makes no claim of traceability, saves nothing
- Flags points only against a tolerance the user enters

## Labels that must stay
- "Tare is not a calibration"
- Draft badge

## Depends on
- Features: calibration, print report

## How to check
- `node scripts/check-site.js`
- Use "Fill example values"; results appear, CSV downloads, report opens
