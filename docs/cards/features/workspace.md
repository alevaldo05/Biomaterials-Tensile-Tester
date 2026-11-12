# Test workspace

Feature card. Update it in the same change as the feature.

## Purpose
The graph-first layout of the test pages and the practice page: a Setup sidebar beside a workspace (toolbar, measurement strip, graph). Setup entries lock while recording and after the test; Save data, New test, and Disconnect follow a finished test.

## Files
- `live-shell.js` (`window.LiveShell`: moves the markup `live.js` builds into the sidebar and the workspace, the sidebar fold and drawer, the strip, the lock note)
- `live-material.js` (`window.LiveMaterial`: the Material box with a small drop-down)
- `live.js` (state, `stripNow`, `endRecording`, `resetTest`, `askSave`, `disconnectNow`)
- `css/workspace.css` (layout, toolbar, strip, drawer, Material drop-down, lock note, dialog)
- `css/guided.css` (step bar and button sizes), `data/terms.js` (`ws_*` strip definitions)

## What the user sees
- Setup sidebar (about 20rem): step bar, the current step, Back/Next; "Hide setup" folds it to a rail, and it folds by itself when recording starts. At 1100 px and narrower, or when large text leaves the workspace under 60rem of room, it is a drawer opened by the toolbar's Setup button (the shell adds the class `ws-narrow`)
- Toolbar: Connection (Connect to tester (USB), or Use simulator on the practice page; Disconnect), Recording (Tare, Start recording, End recording; Save data and New test after a test), Tester (STOP tester and "Not an emergency stop.")
- Measurement strip: Force, Displacement, Elapsed, Stress, Recording status, Data source; a dash when a value is missing; hover or Tab shows what each is
- Material is required (drop-down of Rabbit tissue and Test, or type your own); red outline only after you enter and leave a box
- Entries are locked while recording and after the test until New test (Notes stays editable)

## Load Test
- Load Test uses the same layout through `load-shell.js` (a File sidebar, a toolbar, a strip of facts read from the loaded file, the graph and its panels); see the [Load Test](../pages/load-test.md) card

## Graph and results
- The graph area, its tools, panels, and offset yield are described in the [graph engine](graph-engine.md) card; Setup step 3 has the "Include offset yield (optional)" checkbox and box

## Behavior to keep
- **End recording** only stops saving readings: no stop command is sent and the heartbeat continues, and the message says the tester may still be moving. **STOP tester**, Esc, and the pinned bar send the stop command. How the real tester behaves after End recording is not confirmed (the controller code is a draft)
- New test and Disconnect after a finished test that was not downloaded ask first (Download and continue, Don't save and continue, Cancel; Esc cancels and does not send STOP); Disconnect before a test keeps the entries
- Every element id used by `live.js` stays; calculations, CSV and Excel files, the message format in `data/device.js`, and Esc sending STOP are unchanged
- STOP and "Not an emergency stop." are never covered; Need help? stays above the pinned bar

## Labels that must stay
- "Not an emergency stop." beside STOP tester and on the pinned bar; "Simulated data, not measured" on the practice page; "The hardware connection is untested."

## Depends on
- live test, guided steps, graph engine, shared pop-ups (`SiteUI.dialog`), display settings

## How to check
- `node scripts/check-site.js`; on the practice page run both kinds of test, then Save data, New test, and Disconnect
- On a real test page, a test script may stand in for a serial port (the site never does): Start, End recording (no STOP sent), STOP tester, Esc, locking, New test and Disconnect dialogs
