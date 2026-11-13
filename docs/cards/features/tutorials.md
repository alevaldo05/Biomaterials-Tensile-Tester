# Tutorials

Feature card. Update it in the same change as the feature.

## Purpose
Short animated illustrations of the screen (a simplified drawing with a pointer and numbered captions). Each plays **inline, on the page where you do the thing**, under a "Watch how" button. Built with SVG and CSS only: no video, no outside files, no pop-up.

## Files
- `data/tutorials.js` (`window.TUTORIALS`: the label, and per tutorial the page and place it lives (`page`, `where`), the captions, the boxes that make the simplified screen, and the frames; DRAFT caption wording for the owner to review)
- `tutorials.js` (`window.Tutorials`: `scan(root)`, `show(id)`, `has(id)`; the drawing, playback, the inline panels, and the link list on the Help page)
- `ui.css` (the panel, drawing, and caption styles)
- Spots (`<div class="tut-slot" data-tutorial="ID">`): `live.js` (the practice page: run a simulated test at the top, Dimensions at step 2, read and zoom and download under the graph), `load-test.html` (load and compare), `calibration.html` (calibration)
- `help.html` (the Tutorials section, ids `tutorials-title`, `tutorials-intro`, `tutorials-list`: links to each spot)
- `live.js` (the step "?" buttons and a `#tut-ID` link scroll to and open a tutorial), `help-coach.js` ("Watch how" button), `load-test.js`, `calibration.js` (their tutorial ids)
- `data/search-index.js` (Tutorials entries), `scripts/check-site.js` (checks every box a frame names and that each tutorial has a spot on its page)

## What the user sees
- A **Watch how: <title>** button at the spot; it opens a wide panel with the drawing (drawn about 1.6 times larger so the text stays small), 2 to 4 numbered captions (the current one bold), a loop of about 10 s, and Pause/Play, Replay, and Hide
- When the panel is narrower than 40rem (Reading layout, Sidebar at large text) the captions sit under the drawing so it keeps the full width
- With Motion Reduced (or the system asking for less motion while Motion is Follow system): still frames with Back and Next, no loop
- Help page: a **Tutorials** section (between Keyboard and References) listing the 6 as links to page#tut-ID, which opens the panel

## What the drawings show
- They draw the current workspace, not the old tabs: a Setup sidebar (steps 1 to 5, then the current step) beside the toolbar (Use simulator, Tare, Start recording, End recording, STOP tester with "Not an emergency stop."), the readings strip, and the graph. `data/tutorials.js` has a `sidebar()` helper for the shared sidebar boxes.
- Run a simulated test ends with Save data; Dimensions ends with Next; Read and zoom the graph covers the Readout, the three views, Zoom, Autoscale, Reset view, and Expand graph (closed with Close expanded graph, not Esc); Download shows Save data, New test, PNG, SVG, Print report; Load and compare shows the File sidebar; Calibration is unchanged.
- When the workspace screens change, redraw the matching tutorial.

## Behavior to keep
- Every tutorial says it is an illustration of the screen, not a recording of a real test. The "Connect over USB" tutorial was removed with the website's USB connection; the three that used a test page (`dimensions`, `graph-zoom`, `download`) now live on `practice.html`
- Hidden while a test is recording (no panel near STOP): `Tutorials.show` returns false, the spots are not displayed
- A tutorial's spot must be on the page its data names (checked); add or move one by editing its `tut-slot`
- Theme variables only; nothing is saved or sent
- Add or change a tutorial in `data/tutorials.js` (boxes use a 400 x 250 layout); run `node scripts/check-site.js`

## Labels that must stay
- "Illustration of the screen, not a recording of a real test."

## Depends on
- help-coach, guided-steps, display-settings (Motion)

## How to check
- `node scripts/check-site.js`
- On the practice page: Watch how at the top, at Dimensions, and under the graph; on Load Test and Calibration; Pause, Replay, Hide; Motion Reduced shows still frames
- Start a test: no Watch how is shown while it records
