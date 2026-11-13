# Shared pop-up pieces

Feature card. Update it in the same change as the feature.

## Purpose
Three shared pieces in `window.SiteUI`: a Tip (floating text on hover or focus), a Site pop-up (a `<dialog>` in the site's look), and a Dismissible note (small card with an X). Later stages build on them. Today only the pre-test checklist uses the pop-up.

## Files
- `ui.js` (loads right after `display-settings.js` in `<head>`, before every page script)
- `ui.css` (linked after `layouts.css`)
- `live-checklist.js` (`showChecklist` builds the checklist on `SiteUI.dialog`)
- `css/checklist.css` (checklist-only rules `.pt-*`)
- On every page with the header menu (all except `404.html`)

## What the user sees
- Pre-test checklist pop-up (only when turned on in Settings), looking as before
- No tips or notes yet; they appear in later stages

## Behavior to keep
- Tip: opens on hover and keyboard focus, closes on mouse-out, blur, or Esc; stays inside the window; never moves other content
- Esc closes a tip but is NOT stopped, so Esc still sends STOP on the practice page
- Pop-up: Esc closes it and does not reach the page (Esc does not send STOP)
- Note: not modal, never takes focus, X closes it; its stack sits above the pinned STOP bar
- Fades follow the Motion setting; colors only from theme variables
- Nothing is saved

## Labels that must stay
- Checklist wording from `data/checklist.js`; "reminder, not a safety certification"
- Start disabled until every checklist item is ticked

## Depends on
- Features: live test, display settings (Motion)
- The leave pop-up is built on the Site pop-up (see [leave-popup](leave-popup.md))
- Page ids `pt-title`, `pt-go`, `pt-cancel`, `pt-count`, `r-start`

## How to check
- `node scripts/check-site.js`
- Settings: checklist On, then Start; compare with the previous look in each theme and style; Esc closes it without STOP
