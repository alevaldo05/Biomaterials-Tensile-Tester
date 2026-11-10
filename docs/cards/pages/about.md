# About (about.html)

Page card. Update it in the same change as the page.

## Purpose
Tensile-testing background, Project status, Further reading list, and references.

## Files
- HTML: `about.html` (ids `measures-title`, `why-title`, `compare-title`, `skin-title`, `time-title`, `skin-why-title`, `limits-title`, `status-title`, `reading-title`, `articles`, `refs-title`)
- Scripts in order: `display-settings.js` (head), `data/text/about.js`, `text.js`, `data/articles.js`, `further-reading.js`, `layouts.js`, `data/search-index.js`, `site-search.js`, `page-nav.js`, `build-number.js`
- Words: `data/text/about.js`; list entries: `data/articles.js`

## What the user sees
- Sections: What a tensile test measures, Why it matters, Engineering materials and biomaterials, Skin, Stress relaxation and creep, Limits of this tester today, Project status, Further reading, References
- "On this page" list and Back to top links (`page-nav.js`)

## Behavior to keep
- Further reading shows only entries in `data/articles.js`; empty list shows the empty note (`articles-empty`)
- Never cite a source that was not actually read

## Labels that must stay
- Hardware untested wording in Limits and Project status

## Depends on
- Feature: page text files, site search

## How to check
- `node scripts/check-site.js`
- `check-text.html` reports no problem
- Jump list reaches every section
