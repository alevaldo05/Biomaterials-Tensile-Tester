# Need help? button and hints

Feature card. Update it in the same change as the feature.

## Purpose
A "Need help?" button on the test pages, Load Test, and Calibration, plus small hints that appear by themselves when something may have gone wrong or a person stays on one step for a while. Wording is existing wording only.

## Files
- `help-coach.js` (`window.HelpCoach`: `setContext`, `report`, `resolve`; the button and card)
- `data/help-tips.js` (`window.HELP_TIPS`: times, the Troubleshooting link, and which Troubleshooting row each problem uses)
- `data/text/help.js` (the Troubleshooting rows the hints show; loaded on these pages before `data/help-tips.js`)
- `ui.js` (`SiteUI.note` with a link) and `ui.css` (`.hc-btn`, `.hc-card`)
- `live.js` (`coachContext`, `report` calls for USB permission, port unavailable, no readings, unreadable lines, a field error that stays), `load-test.js` (CSV that cannot be read), `calibration.js` (context)
- `display-settings.js` (key `helpprompts`: `on` default, `off`), `settings.html` (Help prompts option), `page-nav.js` (jump list label)
- `test-uniaxial-tension.html`, `test-stress-relaxation.html`, `load-test.html`, `calibration.html` (script tags)

## What the user sees
- **Need help?** at the bottom right, above the pinned STOP bar; it opens a small card with the current step's existing help wording and a link to Help > Troubleshooting; X closes it
- Hints: one at a time at the bottom left, each with an X; they never take keyboard focus. Triggers: USB permission denied, port unavailable, connected but no readings (5 s after Start), unreadable lines skipped, a CSV that cannot be read, a field error still showing after 8 s, and a minute (60 s) without activity on the same step or page
- Settings > **Help prompts** Off stops the automatic hints; the button stays

## Behavior to keep
- Hints say what could be wrong and the next step; they never claim to diagnose the device
- A hint closed with X stays closed for that problem until the page is reloaded
- Esc is not used to close anything (Esc is STOP on test pages); neither the button nor a hint covers the pinned STOP bar
- No one-minute hint while a test is running or finished (the card shows the page's status line)
- Nothing is stored except the Settings choice
- Every `match` in `data/help-tips.js` must find a Troubleshooting row (checked by `scripts/check-site.js`)

## Labels that must stay
- "Not an emergency stop." and STOP are never covered; "Need help?"

## Depends on
- shared-popups, guided-steps, live-test, display-settings, page-text (the Troubleshooting rows)

## How to check
- `node scripts/check-site.js`
- Use a short time in the browser console (`HELP_TIPS.stuckMs = 1500`) and stay on the Connection step; press Need help? on each page; turn Help prompts Off in Settings
