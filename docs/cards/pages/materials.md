# Materials (materials.html)

Page card. Update it in the same change as the page.

## Purpose
Typical property tables, a two-material comparison, a Young's modulus vs density chart, and an example graph per material. See [materials](../features/materials.md).

## Files
- HTML: `materials.html` (ids `materials-app`, `source-section`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/materials.js`, `data/samples.js`, `data/sample-models.js`, `data/terms.js`, `graph.js`, `excel-export.js`, `material-combobox.js`, `materials.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- CSS: `css/materials.css`, `css/extras.css` (source and review rows)

## What the user sees
- Material box you can type into, details with the Test parameters card under them, tables, chart with filters, "Where these values come from"

## Behavior to keep
- Values are typical, approximate ranges; never presented as measured
- Example curves without a hand-made curve are built from the typical values

## Labels that must stay
- "Typical, unreviewed"
- "Sample data, not measured"
- Draft badge

## Depends on
- Features: materials, graph engine

## How to check
- `node scripts/check-site.js`
- Type in the Material box; Up, Down, Enter, Esc work
