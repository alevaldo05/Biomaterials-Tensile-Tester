# Theme preview (theme-preview.html)

Page card. Update it in the same change as the page.

## Purpose
A preview-only page for choosing color themes: seven color sets side by side with the same samples and measured contrast. It lives on the `theme-preview` branch only. It is not in the menu, not in search, and is not meant to be merged.

## Files
- HTML: `theme-preview.html`
- Scripts in order: `display-settings.js` (head), `theme-preview.js`
- CSS: `styles.css`, `theme-preview.css` (the seven color sets and the sample styling)

## What the user sees
- Seven sets: Green light and Green dark (today), MU green light, MU green dark, MU colors, Purple dark, Pink dark
- For each: a header, buttons, a link, a card, a table, a warning, a small graph, a focus ring, and a measured contrast table
- A "What to decide" list

## Behavior to keep
- Changes no theme and no real page; nothing is saved
- MU values are unverified (from the project plan); colors only, no logo, seal, or wordmark; the set is named "MU colors" and is not called official

## Labels that must stay
- "Unverified" on every MU set; "Sample data, not measured" on the sample graphs

## Depends on
- Feature: display settings and themes (the variable names match `styles.css`)

## How to check
- `node scripts/check-site.js`
- Open the page at 1280 px and 1024 px; every contrast row shows Pass or a marked shortfall
