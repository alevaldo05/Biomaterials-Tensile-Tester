# Simulator (practice page only)

Feature card. Update it in the same change as the feature.

## Purpose
A labeled simulator that behaves like the tester described in `data/device.js`, so the screen can be learned without a tester. It exists ONLY on the practice page (`practice.html`); the real New Test pages and Load Test have no simulator and do not load its code.

## Files
- `live-sim.js` (`window.LiveSim`: the simulator link; loaded only by `practice.html`)
- `live-links.js` (asks for it with `LiveSim.create`; the USB link stays here)
- `live.js` (`data-practice="true"` on `#live-app` shows "Use simulator" and hides USB; real pages show USB and no simulator)
- `practice.html`, `practice-pick.js` (choice of Uniaxial Tension or Stress Relaxation from the address)

## What the user sees
- On the practice page: button **Use simulator**; readings plotted live; the labeled simulated curve
- On the real test pages: no simulator

## Behavior to keep
- Everything it produces is labeled "Simulated data, not measured"; downloaded CSV says simulated
- Uses the labeled sample curves (`data/samples.js`); not data and not measured

## Labels that must stay
- "Simulated data, not measured"

## Depends on
- device message format, sample data, live test

## How to check
- Practice page: connect the simulator, run both kinds of test, download the CSV, open it in Load Test
- A real test page has no "Use simulator" button and does not request `live-sim.js`
