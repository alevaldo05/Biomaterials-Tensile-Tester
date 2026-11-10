# Help (help.html)

Page card. Update it in the same change as the page.

## Purpose
Troubleshooting (problem and action table), Keyboard (only keys that work), and the numbered References list.

## Files
- HTML: `help.html` (ids `trouble-title`, `keys-title`, `helprefs-title`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/references.js`, `data/text/help.js`, `text.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `page-nav.js`, `build-number.js`
- Words: `data/text/help.js`; references: `data/references.js` (37 entries from the owner's research, not independently opened)

## What the user sees
- Troubleshooting table, Keyboard table, numbered References
- No search box of its own (the header search is used)

## Behavior to keep
- Keyboard table lists only keys that really work; update it when a key changes
- Esc closes the search and does not send STOP

## Labels that must stay
- "The on-screen STOP button and the Esc key ... are not an emergency stop"
- Hardware connection draft and untested

## Depends on
- Feature: page text files, site search

## How to check
- `node scripts/check-site.js`
- `check-text.html` reports no problem
- Every key in the table works as stated
