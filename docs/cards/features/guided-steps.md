# Guided test steps

Feature card. Update it in the same change as the feature.

## Purpose
The practice page shows one setup step at a time (the default), with a "Show all steps" switch for the full layout. Helper text that only explained a field moved into "?" tips. Nothing is rebuilt: existing markup is shown and hidden.

## Files
- `live.js` (the "guided steps" section: step bar, Back/Next rows, "?" buttons, `STEP_NAMES`, `HELP`, `stepsUpdate`, `goStep`, `showStepOf`, `openFromHash`)
- `display-settings.js` (`steps` key in `SETTINGS`: `guided` default, `all`)
- `css/guided.css` ( `.gs-bar`, `.sb`, `.gs-nav`, `.gs-why`, `.help-q`, `.gs-switch`)
- `practice.html` (the Governing equations table was replaced by a line and a link to the protocol page)
- `data/terms.js` (definitions used in the step 3 help)

## What the user sees
- The steps now sit in the Setup sidebar of the [workspace](workspace.md) layout; step 4 (Connection) is done with the toolbar's **Use simulator** button, and step 5 keeps the review
- Step bar: 1 Specimen, 2 Dimensions, 3 Test settings, 4 Connection, 5 Review and start. Done steps show a check and a one-line summary and can be reopened; later steps are locked until reached
- Dimensions and Test settings each have their own small link, **Fill example dimensions** and **Fill example settings**, that fills only that step (nothing is prefilled; type your own instead if you prefer). Specimen has none. The links are disabled while a test runs
- Back, Next, Tare, Start recording, End recording, and STOP tester share one height and padding in every style (`css/guided.css`, last rule); STOP stays red
- Back and Next under each step; Next is unavailable until the step's required entries are valid, and the line under it says why (for example "Enter the gauge length in mm.")
- STOP is outside the steps and always shown; Tare, Start, and auto-stop appear on step 5. While recording only the step bar, STOP, and the graph remain
- The graph, Readout, and Key results appear when recording starts; downloads and Print report when the test ends
- "?" on every step heading (both views) shows existing wording as a tip (opens on hover and Tab); clicking it scrolls to and opens that step's tutorial, which plays inline on the page (see [tutorials](tutorials.md))
- "Show all steps" (top right of the page) restores the full layout; saved in this browser (key `steps`); Settings Reset clears it

## Behavior to keep
- `s-example-dims` and `s-example-settings` replace the single `s-example` link; the "example values, not measured" note and the Review line about example dimensions stay
- Every existing `id`, field message, the Review panel and its "Go to this field" buttons (they open the right step), Start disabled until the simulator is used, the checklist pop-up, the pinned STOP bar, the tab-title status, inputs disabled while recording
- Links from search to `#spec-title` and `#rv-title` open step 1 and step 5
- Esc still sends STOP while connected; `.gs-` class names (not `.step-nav`, which the protocol pages use)

## Labels that must stay
- Safety line and "Not an emergency stop."; dimension source note; "Simulated data, not measured"; Draft badge

## Depends on
- live-test, hover-definitions, shared-popups, display-settings

## How to check
- `node scripts/check-site.js`
- On the practice page, press Next through all five steps to Start, for both kinds of test, and run the simulator to a CSV download
- Turn on "Show all steps": the page matches the old full layout; reload keeps the choice
