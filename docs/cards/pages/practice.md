# Practice test page (practice.html)

Page card. Update it in the same change as the page.

## Purpose
Lets a learner try the test screen with a labeled simulator. It is reached from the Learn page ("Practice with a simulated test"), not from the main menu. Nothing on it connects to a tester.

## Files
- HTML: `practice.html` (`live-app` with `data-practice="true"`; the kind of test comes from `#uniaxial` or `#relaxation` in the address)
- Scripts: the same as the test pages, plus `live-sim.js` and `practice-pick.js` (before `live.js`)
- Styles: `css/extras.css` (`.practice-pick`)

## What the user sees
- A banner saying it is practice with simulated data; a choice of Uniaxial Tension or Stress Relaxation; the same setup steps and graph as the real test pages, with **Use simulator** instead of USB

## Behavior to keep
- Always labeled "Simulated data, not measured"; the safety line stays
- Shared behavior is in the live test card; the simulator is in the simulator card

## Labels that must stay
- Draft badge; "Simulated data, not measured"; safety line: the on-screen STOP button is not an emergency stop

## Depends on
- Features: live test, simulator, graph engine, downloads, tutorials

## How to check
- `node scripts/check-site.js`
- Choose each kind of test, connect the simulator, run, download the CSV
