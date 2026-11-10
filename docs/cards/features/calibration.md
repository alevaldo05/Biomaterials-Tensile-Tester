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
- No reading changes; no traceability claim; nothing saved
- Leave warning when values are typed: the site pop-up for links inside the site (see [leave-popup](leave-popup.md)) and `beforeunload` for closing the tab, reload, and Back

## Labels that must stay
- "Tare is not a calibration"
- Draft

## Depends on
- Print report

## How to check
- Example values give results; CSV downloads
