# Compare

Feature card. Update it in the same change as the feature.

## Purpose
Overlay several CSV files of one test type on Load Test.

## Files
- `compare.js`
- `load-test.js`
- `graph.js` (numbers)

## What the user sees
- Overlay graph, table per specimen with mean and sample standard deviation, summary CSV, Copy summary, PNG, SVG, Excel, Print

## Behavior to keep
- Up to 12 files of one test type
- Warnings for mixed simulated/measured data, mixed materials, or missing dimensions

## Labels that must stay
- "Simulated data, not measured"

## Depends on
- Graph engine

## How to check
- Compare two files; warnings appear for a mix
