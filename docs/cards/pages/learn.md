# Learn (learn.html)

Page card. Update it in the same change as the page.

## Purpose
Before you test (checklist), Practice with a simulated test (a link to the practice page; it says the website does not connect to the tester and real tests are run in the tester app), Getting access to the tester (how admin, operators, and students sign in on the lab computer; draft wording for the owner's review), Background (biomechanics, why tensile testing matters for skin), and the Glossary.

## Files
- HTML: `learn.html` (ids `before-title`, `practice-title`, `access-title`, `bg-title`, `gloss-title`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/checklist.js`, `data/text/learn.js`, `report.js`, `text.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- Words: `data/text/learn.js`
- CSS: `css/home.css` (Home additions), `css/extras.css` (Back to top)

## What the user sees
- Checklist, background text, Glossary term list
- "Print blank run sheet" button (added by `text.js` only when `report.js` is loaded)

## Behavior to keep
- Checklist wording matches `data/checklist.js` (the optional pre-test pop-up)
- Getting access says the website has no sign-in and saves nothing, and that sign-in is not a safety lock; the section sits in `data/text/learn.js` and is listed in `text.js` (check 17)
- Back to top link at the end

## Labels that must stay
- Draft badge on the checklist (`data/checklist.js` badge)

## Depends on
- Feature: page text files, print report

## How to check
- `node scripts/check-site.js`
- Open `check-text.html`; the Learn sections load
- Print blank run sheet opens the print window
