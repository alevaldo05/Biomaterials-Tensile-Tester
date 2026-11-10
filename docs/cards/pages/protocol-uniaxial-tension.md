# Uniaxial Tension protocol (protocol-uniaxial-tension.html)

Page card. Update it in the same change as the page.

## Purpose
Draft procedure in four tabs. See [protocols](../features/protocols.md).

## Files
- HTML: `protocol-uniaxial-tension.html` (ids `protocol-app`, `graph-section`, `graph-app`, `equations-section`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/materials.js`, `data/samples.js`, `data/sample-models.js`, `data/protocols.js`, `data/terms.js`, `graph-core.js`, `graph.js`, `excel-export.js`, `protocol-page.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`

## What the user sees
- Tabs: Steps (with Jump to step), Specimen and equipment, Report and notes, Example graph and equations
- Material list: General, To be added at a later date

## Behavior to keep
- Only General text exists in `data/protocols.js`; the second choice shows it with a note
- Equations stay in a collapsible section
- Links like `#skin`, `#skin/step-3`, `#skin/graph`

## Labels that must stay
- Draft badge, "Draft for advisor review"
- "Sample data, not measured" on the example graph

## Depends on
- Features: protocols, graph engine, materials

## How to check
- `node scripts/check-site.js`
- Open each tab and a `#general/step-3` style link
