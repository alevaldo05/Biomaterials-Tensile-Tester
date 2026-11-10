# Settings (settings.html)

Page card. Update it in the same change as the page.

## Purpose
Display choices remembered in this browser. See [display settings and themes](../features/display-settings.md).

## Files
- HTML: `settings.html` (fieldsets `set-theme`, `set-layout`, `set-font`, `set-style`, `set-textsize`, `set-spacing`, `set-motion`, `set-linewidth`, `set-curve`, `set-grid`, `set-stressunit`, `set-strainunit`, `set-digits`, `set-checklist`; button `reset-display`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `layouts.js`, `data/search-index.js`, `site-search.js`, `page-nav.js`, `build-number.js`
- CSS: `styles.css` Settings, `layouts.css` Settings page choices

## What the user sees
- Theme, font, layout, style, text size, spacing, motion, graph line, curve, grid, stress unit, strain unit, digits, pre-test checklist, Reset

## Behavior to keep
- Choices change appearance only; CSV and Excel numbers stay in base units
- Saved keys and allowed values live in `display-settings.js`

## Labels that must stay
- Checklist described as a reminder, not a safety certification

## Depends on
- Feature: display settings and themes, layouts, styles

## How to check
- `node scripts/check-site.js`
- Change each choice, reload, it is kept; Reset clears it
