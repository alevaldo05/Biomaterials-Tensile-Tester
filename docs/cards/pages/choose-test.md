# Choose a test (choose-test.html)

Page card. Update it in the same change as the page.

## Purpose
The page after New Test: Uniaxial Tension or Stress Relaxation, each opening its own test page.

## Files
- HTML: `choose-test.html`
- Scripts in order: `display-settings.js`, `ui.js` (head), `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- CSS: `styles.css` Test choices

## What the user sees
- Two choices: Uniaxial Tension and Stress Relaxation

## Behavior to keep
- Each choice links to its own test page

## Labels that must stay
- Titles Uniaxial Tension, Stress Relaxation

## Depends on
- Pages: test-uniaxial-tension, test-stress-relaxation

## How to check
- `node scripts/check-site.js`
- Both links open the right test page
