# Home (index.html)

Page card. Update it in the same change as the page.

## Purpose
Homepage: title, the New Test and Load Test actions, the About the tester paragraph, How it works (three steps), and Protocols and procedures.

## Files
- HTML: `index.html` (headings, layout, ids `hero-title`, `about-title`, `how-title`, `proto-title`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `data/text/home.js`, `text.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- Words: `data/text/home.js` (see `EDITING-TEXT.md`)
- CSS: `styles.css` (Top bar), `css/home.css` (Home, Home additions); `layouts.css` Start screen

## What the user sees
- Header with logo, main menu (Home, Learn, Protocols, Materials, Calibration, About, Help, Settings) and the search button
- Heading **Biomaterials Tensile Tester**, "Choose a test to get started.", primary **New Test**, **Load Test**
- Protocols and procedures links, marked Draft (a card in the Start screen layout)

## Behavior to keep
- Browser tab title is the same as the heading
- Words come from `data/text/home.js`; headings and layout stay in the HTML
- File name stays `index.html` (servers open it by default)

## Labels that must stay
- Draft badge on Protocols and procedures

## Depends on
- Feature: page text files, site search, layouts

## How to check
- `node scripts/check-site.js`
- Open at 1280 px and 1024 px; the title wraps without clipping or sideways scrolling
- `check-text.html` reports no problem
