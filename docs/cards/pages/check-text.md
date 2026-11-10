# Text checker (check-text.html)

Page card. Update it in the same change as the page.

## Purpose
Tells the owner whether each file in `data/text/` loads and is readable. Not in the menu.

## Files
- HTML: `check-text.html` (`check-report`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `check-text-errors.js`, `data/checklist.js`, `data/text/home.js`, `data/text/learn.js`, `data/text/help.js`, `data/references.js`, `data/text/about.js`, `text.js`, `data/search-index.js`, `site-search.js`, `check-text.js`, `build-number.js`

## What the user sees
- A report per text file naming the file and line of a mistake

## Behavior to keep
- `check-text-errors.js` loads first (pages allow no inline scripts)

## Labels that must stay
- None specific

## Depends on
- Feature: page text files

## How to check
- Open it; every file reads "good"
