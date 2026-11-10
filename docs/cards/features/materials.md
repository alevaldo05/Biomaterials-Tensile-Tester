# Materials data and chart

Feature card. Update it in the same change as the feature.

## Purpose
Typical property ranges, comparison, chart, and example curves.

## Files
- `data/materials.js` (46 materials, 7 families)
- `data/sample-models.js`
- `data/samples.js`
- `materials.js`
- `material-combobox.js`
- Page `materials.html`

## What the user sees
- Typing Material box, tables, comparison, Young's modulus vs density chart

## Behavior to keep
- Values stay "Typical, unreviewed" until the owner or advisor approves them
- Never cite a source that was not actually read

## Labels that must stay
- "Typical, unreviewed"
- "Sample data, not measured"

## Depends on
- Graph engine

## How to check
- Chart keys work; example graph per material loads
