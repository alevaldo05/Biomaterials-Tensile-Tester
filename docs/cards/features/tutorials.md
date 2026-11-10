# Tutorials

Feature card. Update it in the same change as the feature.

## Purpose
Short animated illustrations of the screen (a simplified drawing with a pointer and numbered captions), opened in the site pop-up. Built with SVG and CSS only: no video, no outside files.

## Files
- `data/tutorials.js` (`window.TUTORIALS`: the label, and per tutorial the captions, the boxes that make the simplified screen, and the frames; DRAFT caption wording for the owner to review)
- `tutorials.js` (`window.Tutorials`: `open(id)`, `has(id)`; the drawing, playback, and the list on the Help page)
- `ui.css` (the pop-up, drawing, and caption styles)
- `help.html` (the Tutorials section, ids `tutorials-title`, `tutorials-intro`, `tutorials-list`)
- `live.js` (the step "?" buttons open a tutorial; `TUT_OF`), `help-coach.js` ("Watch how" button), `load-test.js`, `calibration.js` (their tutorial ids)
- `data/search-index.js` (Tutorials entries), `scripts/check-site.js` (checks every box a frame names)

## What the user sees
- Help page: a **Tutorials** section (between Keyboard and References) listing 7 tutorials: run a simulated test, enter specimen dimensions, connect over USB (marked untested), read and zoom the graph, download the data, load and compare files, enter a calibration
- A pop-up with the drawing, 2 to 4 numbered captions (the current one bold), a loop of about 10 s, and Pause/Play, Replay, and X
- With Motion Reduced (or the system asking for less motion while Motion is Follow system): still frames with Back and Next, no loop
- Opens from the Help list, from Need help? ("Watch how"), and by clicking a step's "?" on the test pages

## Behavior to keep
- Every tutorial says it is an illustration of the screen, not a recording of a real test; the USB one also says the hardware connection is untested
- Not offered while a test is recording (the pop-up would cover STOP): `Tutorials.open` returns false, "Watch how" is hidden
- Esc closes the pop-up and does not send STOP; the page behind is unchanged
- Theme variables only; nothing is saved or sent
- Add or change a tutorial only in `data/tutorials.js` (boxes use a 400 x 250 drawing); run `node scripts/check-site.js`

## Labels that must stay
- "Illustration of the screen, not a recording of a real test."
- "The hardware connection is untested." on the USB tutorial

## Depends on
- shared-popups, help-coach, guided-steps, display-settings (Motion)

## How to check
- `node scripts/check-site.js`
- Open each tutorial from Help; Pause, Replay, X, Esc; set Motion to Reduced and check the still frames
- On a test page: click a step's "?", use Need help? > Watch how; start a test and confirm neither opens a tutorial
