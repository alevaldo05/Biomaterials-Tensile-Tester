# Leave pop-up

Feature card. Update it in the same change as the feature.

## Purpose
A "Leave without saving?" pop-up in the site's look when a click on a link inside the site would lose a recording, an undownloaded test, or typed calibration values. Browsers' own box (tab close, reload, Back) cannot be restyled and stays.

## Files
- `ui.js` (`SiteUI.leaveGuard(fn)`, `SiteUI.navigate(url)`, `SiteUI.leaving`)
- `ui.css` (`.lv-text`, `.lv-choices`, `.lv-choice`)
- `live.js` (guard for `running || (hasData && !downloaded)`; STOP and Download buttons call the page's own `stopTest` and `#dl-csv`)
- `calibration.js` (guard for typed values; Download calls `#c-dl`)
- `site-search.js` (search results go through `SiteUI.navigate`)
- `data/text/help.js` (note that the browser's own box stays for closing, reload, and Back)

## What the user sees
- A pop-up with full-width choices, each a bold label and one plain line saying what it does: **STOP — sends a stop command** ("Stops the test. Not an emergency stop.", only while recording), **Stay** (focused), **Download CSV and leave** / **Download record and leave** (only when there is something to download), **Leave without saving**
- While recording: the text says leaving does not stop the machine; no download choice until the test has stopped. Pressing STOP updates the pop-up to the stopped wording
- STOP is red, Stay uses the accent color, the others are quiet outlines (Leave is not red, so it is never confused with STOP)

## Behavior to keep
- Esc means Stay and does not send STOP (the pop-up is a site pop-up; see shared-popups). STOP is reachable inside the pop-up while recording
- Not caught (no pop-up): `#`-only links, new-tab links, ctrl/cmd/shift-clicks, `download` links, `mailto:` and `tel:` links
- Choosing Leave skips the page's own `beforeunload` box once (`SiteUI.leaving`); both `beforeunload` handlers stay for closing, reload, and Back
- Nothing is saved or sent; no pop-up when the data has been downloaded or nothing is typed

## Labels that must stay
- "Not an emergency stop." beside the STOP button in the pop-up
- "STOP — sends a stop command"

## Depends on
- shared-popups, live-test, calibration, site-search

## How to check
- `node scripts/check-site.js`
- Simulated test: click Home while recording (STOP button works), after stopping (Download, Leave, Stay), after downloading (no pop-up)
- Calibration: Fill example values, then click Home
