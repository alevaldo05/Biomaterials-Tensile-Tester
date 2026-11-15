# Page text files

Feature card. Update it in the same change as the feature.

## Purpose
The words on Home, Learn, About, and Help live in plain files.

## Files
- `text.js`
- `data/text/home.js`, `data/text/learn.js`, `data/text/about.js`, `data/text/help.js`
- `EDITING-TEXT.md`
- `check-text.html`, `check-text.js`, `check-text-errors.js`

## What the user sees
- Page sections filled from the files; a visible box if a file has a mistake

## Behavior to keep
- Headings and layout stay in the HTML
- A section that holds only its heading on a page that takes its words from `data/text/` must be listed for that page in `text.js`; `check-site.js` check 17 fails otherwise (the Learn `access-title` section was empty until it was listed)

## Labels that must stay
- None specific

## Depends on
- Pages Home, Learn, About, Help

## How to check
- Open `check-text.html`
