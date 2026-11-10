# Hover definitions

Feature card. Update it in the same change as the feature.

## Purpose
Terms with a dotted underline show a small box (name, one-line definition, equation, unit) on hover or Tab focus, so the pages need less explanatory text. Built on the shared Tip (see [shared-popups](shared-popups.md)).

## Files
- `data/terms.js` (`window.TERMS`; wording copied from the Glossary in `data/text/learn.js` and the Governing equations tables; no new claims or sources)
- `ui.js` (delegation: any `data-term="key"` or `data-tip-id="id"` element gets a tip), `ui.css` (dotted underline, tip layout)
- `graph.js` (Key results names use `data-tip-id` and show the live `.def` text; Readout labels use `READOUT_TERMS`)
- `live.js` (`FIELD_TERMS`: Gauge length, Crosshead speed, Hold displacement; Area and Hold strain labels)
- `compare.js` (`TERM_OF`: result column headings and Standard deviation), `materials.js` (`MAT_TERMS`: Young's modulus, Tensile strength), `calibration.js` (Force, Error, Error %, Gain, Zero offset)
- `data/text/help.js` (Keyboard row)
- Loaded before `graph.js` on the test, Load Test, Materials, and protocol pages, and before `report.js` on Calibration

## What the user sees
- Dotted underline on defined terms; the tip floats over the page and never moves content
- Key results: the same definition text as the "Show definitions" switch (one source)

## Behavior to keep
- Tips open on hover and on Tab (the term needs `tabindex="0"` unless it is a button)
- Esc closes a tip and is not stopped, so Esc still sends STOP on test pages
- The "Show definitions" switch (off by default), the `.def` text, CSV, Excel, and the printed report are unchanged
- The Readout updates values in place so a focused label keeps focus while recording
- Terms with no wording already in the project (density, elongation, Poisson's ratio, time, displacement) have no tip; add the entry in `data/terms.js` once the owner has approved wording

## Labels that must stay
- All labels listed on the live test, calibration, and materials cards; tips never replace or cover STOP or the safety line

## Depends on
- shared-popups, graph-engine, live-test

## How to check
- `node scripts/check-site.js` (checks `data/terms.js`)
- Load a sample CSV in Load Test: hover "Automatic modulus estimate, E" and Tab to a Readout label; values are unchanged
