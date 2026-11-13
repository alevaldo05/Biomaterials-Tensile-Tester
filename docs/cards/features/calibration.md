# Calibration

Feature card. Update it in the same change as the feature.

## Purpose
Fit a line to hand-typed readings versus known masses (F = m g).

## Files
- `calibration.js`
- `report.js`
- Page `calibration.html`

## What the user sees
- Table, fit, errors, chart, CSV record, Copy results, Print

## Behavior to keep
- The tester app has its own check on its Device screen (apps/tester/src/calibration-check.ts) using the same maths (`packages/core/src/calibration.ts`); its CSV names its own source and title (optional `source` and `title` in `calibrationCsv`); the website's CSV is unchanged
- Column headings and Gain/Zero offset show a definition tip (see [hover-definitions](hover-definitions.md))
- No reading changes; no traceability claim; nothing saved
- Leave warning when values are typed: the site pop-up for links inside the site (see [leave-popup](leave-popup.md)) and `beforeunload` for closing the tab, reload, and Back

## Labels that must stay
- "Tare is not a calibration"
- Draft

## Depends on
- Print report

## How to check
- Example values give results; CSV downloads
