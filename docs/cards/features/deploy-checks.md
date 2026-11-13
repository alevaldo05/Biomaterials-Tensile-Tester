# Deploy and checks

Feature card. Update it in the same change as the feature.

## Purpose
Publishing with GitHub Pages and the pre-publish checks.

## Files
- `scripts/check-site.js`
- `scripts/check-combinations.js` (optional, by hand; needs Playwright; every theme x layout x style plus pairwise coverage of all display choices)
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
- The tester app is not published; `deploy.yml` builds only the website

## Labels that must stay
- None specific

## Depends on
- All pages

## How to check
- `node scripts/check-site.js`
