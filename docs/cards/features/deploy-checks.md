# Deploy and checks

Feature card. Update it in the same change as the feature.

## Purpose
Publishing with GitHub Pages and the pre-publish checks.

## Files
- `scripts/check-site.js`
- `scripts/check-combinations.js` (optional, by hand; needs Playwright; every theme x layout x style plus pairwise coverage of all display choices; `--browser=webkit` runs it in Playwright's WebKit, which is not Safari)
- `scripts/check-spacing.mjs` (dev only; website pages and app screens at 1366 to 390 px, light and dark; `--strict` fails on any issue; `--browser=webkit` as above)
- `.github/workflows/spacing.yml` ("Spacing check": runs `check-spacing.mjs --strict` on pull requests that change the website, the app, the shared packages, or the check; uploads pictures and report for 14 days)
- `scripts/build-site.sh` (writes `version.json` with `"version": "2.0"`, the commit, and the build time)
- `.github/workflows/deploy.yml`
- `docs/DEPLOY.md`
- `docs/BRANCHES.md`
- `docs/REPO-SETTINGS.md`

## What the user sees
- The footer line "Version 2.0" (with " · build <commit>" on the deployed site), written by `build-number.js` (see the [site footer](site-footer.md) card)

## Behavior to keep
- Check runs on every pull request and before every publish
- `*.md` and `docs/` are not published
- The owner opens pull requests and merges
- `check-site.js` also checks that every page loading `page-help.js` has its own words in `data/page-help.js` and loads the help scripts in order, and that no page links to the retired `app/` folder
- `check-site.js` check 16 checks the page source on every page for accessibility basics (images have alt, controls have a name, no skipped heading levels, one h1, html lang); check 17 checks that sections holding only a heading are listed in `text.js`
- The tester app is not published; `deploy.yml` builds only the website

## Labels that must stay
- None specific

## Depends on
- All pages

## How to check
- `node scripts/check-site.js`
- `node scripts/check-spacing.mjs --strict` (needs Playwright's Chromium; `--browser=webkit` for WebKit)
