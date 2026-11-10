# Deploy and checks

Feature card. Update it in the same change as the feature.

## Purpose
Publishing with GitHub Pages and the pre-publish checks.

## Files
- `scripts/check-site.js`
- `scripts/build-site.sh`
- `.github/workflows/deploy.yml`
- `docs/DEPLOY.md`
- `docs/BRANCHES.md`
- `docs/REPO-SETTINGS.md`

## What the user sees
- Nothing on the site

## Behavior to keep
- Check runs on every pull request and before every publish
- `*.md` and `docs/` are not published
- The owner opens pull requests and merges

## Labels that must stay
- None specific

## Depends on
- All pages

## How to check
- `node scripts/check-site.js`
