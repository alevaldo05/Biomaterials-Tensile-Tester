# Simulator

Feature card. Update it in the same change as the feature.

## Purpose
A labeled stand-in for the tester so every feature works without hardware and in Safari.

## Files
- `live.js` (the "Use simulator" link)
- `data/samples.js`, `data/sample-models.js` (curves)
- `graph.js` (source labels)

## What the user sees
- Button **Use simulator**; readings plotted live

## Behavior to keep
- Everything it produces is labeled "Simulated data, not measured"
- Works in every target browser

## Labels that must stay
- "Simulated data, not measured"

## Depends on
- Live test

## How to check
- Run both tests; the label shows in the graph, CSV, and report
