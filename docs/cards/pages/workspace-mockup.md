# Workspace mock-up (workspace-mockup.html)

Page card. Update it in the same change as the page.

## Purpose
A throwaway preview of the graph-first test workspace (setup sidebar, toolbar, measurement strip, large graph, collapsible panels) for the owner to review. Not linked from the menu or search. Demo data only.

## Files
- HTML: `workspace-mockup.html`
- Script: `workspace-mockup.js` (a demo curve; no Web Serial; key results come from `graph-core.js`; saves and sends nothing)
- Styles: `css/workspace-mockup.css` (the one extra stylesheet; `scripts/check-site.js` skips this page in the stylesheet-order check)

## What the user sees
- The new layout with "Mock-up: demo data, not measured" shown on the page, the graph, and the strip
- Use simulator, Start recording (draws the demo curve), End recording, STOP tester, three graph views, zoom and pan, Expand graph, setup sidebar hide and drawer

## Also in the mock-up
- Hover and Tab-focus definitions on every strip name and value, Key results name and value, and key-point label (the site's `data-term` mechanism; `data/terms.js` plus mock-up-only entries in `workspace-mockup.js`)
- An editable graph title (Customize panel, after the test; empty restores the automatic title)
- Offset yield is opt-in: a "Include offset yield (optional)" checkbox in Setup step 3 (unticked by default) reveals a required Offset (% strain) box (empty, 0.05 to 5). Unticked, offset yield appears nowhere (Key results, tick box, graph, cursor). It locks with the other entries and clears on New test and Disconnect
- Disconnect after a finished test discards the run: if it is unsaved the dialog asks "Save this test before you disconnect?"; then everything resets to Not connected. Disconnect before a test keeps the entries
- The graph cursor snaps to the key points that are shown (within about 14 px) and names them (for example "Ultimate tensile strength (UTS)") in the readout box and the Readout panel; elsewhere it follows the nearest recorded point
- A demo curve in `workspace-mockup.js` (toe, linear region of about 40 MPa, rounded peak of about 16 MPa, gradual drop; ends when force falls below half of the peak). It is illustrative, not the site's sample data, and not measured

## Behavior to keep
- Delete this page, its script, stylesheet, card, and the check exception when the real workspace replaces it

## Labels that must stay
- "Not an emergency stop."; "Mock-up: demo data, not measured"; "The hardware connection is untested."; Draft badge

## Depends on
- display-settings, theme variables

## How to check
- `node scripts/check-site.js`; open the page at 1366, 1280, 1024, 768, 390 px
