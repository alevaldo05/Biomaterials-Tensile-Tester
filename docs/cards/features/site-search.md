# Site search

Feature card. Update it in the same change as the feature.

## Purpose
Magnifying-glass button after Settings that lists matching pages and sections.

## Files
- `site-search.js`
- `data/search-index.js`

## What the user sees
- Search box with results

## Behavior to keep
- Up, Down, Enter, Esc work; Esc closes search and does not send STOP
- Does not move the logo, title, or menu; saves nothing
- Not on the 404 page

## Labels that must stay
- None specific

## Depends on
- Page ids

## How to check
- `node scripts/check-site.js` tests every entry
