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
