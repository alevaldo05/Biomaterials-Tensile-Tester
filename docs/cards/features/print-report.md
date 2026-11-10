# Print report

Feature card. Update it in the same change as the feature.

## Purpose
A one-page, Draft-labeled report opened in the browser print window.

## Files
- `report.js`
- Used by `graph.js` (the Print report button on test pages and Load Test), `compare.js`, `calibration.js`, and `text.js` (blank run sheet on Learn)
- CSS: `css/report.css`

## What the user sees
- Print report button; blank run sheet on Learn

## Behavior to keep
- Never saved or uploaded
- States whether data is measured, simulated, or loaded

## Labels that must stay
- Draft
- "Tare is not a calibration" on the calibration report

## Depends on
- Graph engine, calibration, compare

## How to check
- Print preview shows one page for each page that offers it
