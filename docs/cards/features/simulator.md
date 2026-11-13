# Simulator (practice page only)

Feature card. Update it in the same change as the feature.

## Purpose
A labeled simulator that behaves like the tester described in `data/device.js`, so the screen can be learned without a tester. It exists ONLY on the practice page (`practice.html`); the website has no other test screen and no USB connection, and Load Test has no simulator and does not load its code.

## Files
- `live-sim.js` (`window.LiveSim`: the simulator link; loaded only by `practice.html`)
- `live-links.js` (asks for it with `LiveSim.create`; the simulator is its only link, the USB link was removed)
- `live.js` (the practice page's screen: the **Use simulator** button, `c-sim`)
- `data/device.js` (the line format it emits and parses; not the tester app's protocol)
- `practice.html`, `practice-pick.js` (choice of Uniaxial Tension or Stress Relaxation from the address)

## What the user sees
- On the practice page: button **Use simulator**; readings plotted live; the labeled simulated curve
- No other page has a simulator

## Behavior to keep
- Everything it produces is labeled "Simulated data, not measured"; downloaded CSV says simulated
- Uses the labeled sample curves (`data/samples.js`); not data and not measured

## Labels that must stay
- "Simulated data, not measured"

## Depends on
- device message format, sample data, live test

## How to check
- Practice page: connect the simulator, run both kinds of test, download the CSV, open it in Load Test
- No page other than `practice.html` requests `live-sim.js`; no page has a USB button
