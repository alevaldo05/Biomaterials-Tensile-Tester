# Practice test page (practice.html)

Page card. Update it in the same change as the page.

## Purpose
Lets a learner try the test screen with a labeled simulator. It is the website's only test screen: the website's own live test pages (and its USB connection) were retired, and real tests are run in the tester app. It is reached from the New Test page and from the Learn page ("Practice with a simulated test"), not from the main menu. Nothing on it connects to a tester.

## Files
- HTML: `practice.html` (`live-app`; the kind of test comes from `#uniaxial` or `#relaxation` in the address)
- Scripts, in the order in `practice.html`: `live-links.js`, `live-sim.js`, `live-checklist.js`, `live-csv.js`, `live-material.js`, `live-shell.js`, `practice-pick.js`, then `live.js`
- Styles: `css/extras.css` (`.practice-pick`)

## What the user sees
- A banner saying it is practice with simulated data; a choice of Uniaxial Tension or Stress Relaxation; the setup steps (Specimen, Dimensions, Test settings, Connection, Review and start), the Fill example links, the toolbar (**Use simulator**, Tare, Start recording, End recording, STOP tester with "Not an emergency stop."), the measurement strip, and the graph

## Behavior to keep
- Always labeled "Simulated data, not measured"; the safety line stays; no USB or serial code is loaded (`live-links.js` makes only the simulator link)
- Shared behavior is in the live test card; the simulator is in the simulator card

## Labels that must stay
- Draft badge; "Simulated data, not measured"; safety line: the on-screen STOP button is not an emergency stop

## Depends on
- Features: live test, workspace, simulator, graph engine, downloads, tutorials (all four tutorials of the screen play here: run a simulated test, dimensions, read and zoom the graph, download the data)

## How to check
- `node scripts/check-site.js`
- Choose each kind of test, connect the simulator, run, download the CSV
