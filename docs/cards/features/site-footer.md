# Site footer and version

Feature card. Update it in the same change as the feature.

## Purpose
Every page with the header menu ends with a footer line that says which release this is: "Version 2.0". On the deployed site the commit follows it.

## Files
- `build-number.js` (builds the footer; the release number is `VERSION` at its top)
- `scripts/build-site.sh` (`version.json` has the same `"version"`) and `scripts/check-site.js` (checks it)
- `css/extras.css` (`.site-footer`, `.build-number`)

## What the user sees
- A bar under the page with "Version 2.0"; on the deployed site "Version 2.0 \u00b7 build 908eff0" (the first seven characters of the commit; a local copy has no build id)
- In the Sidebar layout the line sits under the note at the foot of the menu
- Hidden when printing

## Behavior to keep
- Change the release number in `build-number.js` and `scripts/build-site.sh` together; the check fails if `version.json` disagrees with 2.0
- No footer on `404.html` (it has no header menu)
- Renaming the GitHub repository or making a release is done by the owner on GitHub

## Labels that must stay
- "Version 2.0"

## Depends on
- deploy and checks

## How to check
- `node scripts/check-site.js`; open any page and look at the foot; open `/version.json` on the deployed site
