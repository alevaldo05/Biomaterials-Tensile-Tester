# Stress Relaxation protocol (protocol-stress-relaxation.html)

Page card. Update it in the same change as the page.

## Purpose
Draft procedure for Stress Relaxation, same four tabs. See [protocols](../features/protocols.md).

## Files
- HTML: `protocol-stress-relaxation.html`
- Scripts in order: same as the Uniaxial Tension protocol: `display-settings.js`, `ui.js` (head), `data/materials.js`, `data/samples.js`, `data/sample-models.js`, `data/protocols.js`, `data/terms.js`, `graph.js`, `excel-export.js`, `protocol-page.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`

## What the user sees
- Same tabs as the Uniaxial Tension protocol

## Behavior to keep
- Same rules as the Uniaxial Tension protocol card

## Labels that must stay
- Draft badge, "Draft for advisor review"
- "Sample data, not measured"

## Depends on
- Features: protocols, graph engine

## How to check
- `node scripts/check-site.js`
- Open each tab
