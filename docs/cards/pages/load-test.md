# Load Test (load-test.html)

Page card. Update it in the same change as the page.

## Purpose
Open an earlier CSV in the browser only, or compare several files. See [compare](../features/compare.md).

## Files
- HTML: `load-test.html` (ids `load-form`, `mode-one`, `load-file`, `mode-compare`, `cmp-file`, `graph-app`, `compare-app`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/samples.js`, `data/text/help.js`, `data/help-tips.js`, `data/terms.js`, `data/tutorials.js`, `graph-core.js`, `graph.js`, `excel-export.js`, `report.js`, `tutorials.js`, `help-coach.js`, `load-test.js`, `compare.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`

## What the user sees
- Mode switch (one file, Compare several files), file picker, drop onto the page
- Graph, Key results, File details, Print report; for compare an overlay graph, key results per specimen with mean and sample standard deviation, summary CSV, Copy summary

## Graph
- The graph has the workspace tools (view choice, Autoscale, Reset view, Expand graph, white/black look, Background) described in the [graph engine](../features/graph-engine.md) card; Customize graph is always available because the file is already a finished test. The offset-yield row appears only when the file's header has the optional offset line (or the existing 0.2% option is ticked)

## Behavior to keep
- No upload and no storage; the file stays in the tab
- Compare takes up to 12 files of one test type and warns on mixed simulated/measured data, mixed materials, or missing dimensions

## Labels that must stay
- "Simulated data, not measured"
- "Sample data, not measured"
- Draft badge on printed report

## Depends on
- Features: graph engine, compare, CSV and Excel downloads, print report

## How to check
- `node scripts/check-site.js`
- Load a CSV downloaded from the practice page; key results match the page it came from
- Compare two files
