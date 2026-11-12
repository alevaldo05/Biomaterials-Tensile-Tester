# Graph engine

Feature card. Update it in the same change as the feature.

## Purpose
`window.TensileGraph`: plain SVG graph, Readout, Key results, graph tools, CSV reading, downloads.

## Files
- `graph-core.js` (`window.TensileGraphCore`: the calculations, key results, data checks, and CSV reading; no drawing; loads before `graph.js`)
- `graph.js` (the interactive graph: `TensileGraph.mount`, the readout, tools, customization, and PNG/SVG download)
- `excel-export.js` (loaded right after)
- CSS: `css/graph.css` (Graph pages, graph tools, Key results)
- Used by the test, protocol, Load Test, and Materials pages

## Workspace graph (test pages, practice page, Load Test)
- A view choice (Force-displacement, Stress-strain, Force-time; relaxation: Stress-time, Force-time) with Autoscale, Reset view, Expand graph. Stress-strain needs valid dimensions and says so when it cannot be drawn. The views only change which recorded arrays are plotted; key points are mapped with exact conversions (displacement = strain x L0, force = stress x A0)
- Starts white with a black curve (dark when the page theme is dark); Customize graph adds a Background choice; exports use the same colors
- While a test records the axis maximum grows in steps of about 20%
- On the live pages Readout and Key results are collapsible panels (closed while recording, open at the end) and Customize graph appears after the test
- When key results are shown on the graph the cursor snaps to one within about 14 px and names it
- Offset yield is opt-in (`params.offsetPct`): toe-compensated, labeled an estimate; no row, tick box, or marker when it was not asked for

## What the user sees
- Graph, Readout, Key results with a "Show definitions" switch (`show-defs`, off by default, not a Settings option)
- Region guides, highlighted key results, zoom and pan, tangent line, Customize graph
- Copy results (`copy-res`), File details (`file-details`)

## Behavior to keep
- Key results names and Readout labels show a definition tip on hover or Tab (see [hover-definitions](hover-definitions.md))
- Graph tools change the display only, never calculated results
- Modulus is a fitted interval estimate; yield is the 0.2% offset; UTS is the maximum stress
- Display units (kPa, %, digits) change appearance only

## Labels that must stay
- "Simulated data, not measured"
- "Sample data, not measured"

## Depends on
- Display settings (units, line, grid)
- Materials data for example values

## How to check
- Open a sample CSV in Load Test before and after a change; key results are identical
