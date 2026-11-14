# Display settings and themes

Feature card. Update it in the same change as the feature.

## Purpose
Saved display choices and the six color themes (green light, green dark, purple light, purple dark, pink light, pink dark).

## Files
- `display-settings.js` (the `SETTINGS` table)
- `settings.html`
- CSS: variable blocks at the top of `styles.css`

## What the user sees
- Settings page choices; theme colors the tab icon

## Behavior to keep
- Stored names `light`, `dark`, `purple`, `pink` stay (new: `purple-dark`, `pink-dark`); any other saved value falls back to green light
- Saved in this browser only; appearance only
- Help prompts (key `helpprompts`: `on` default, `off`) turn the automatic hints off; see [help-coach](help-coach.md)
- Also saved by the practice page (not on the Settings page): key `steps` (`guided`, `all`), see [guided-steps](guided-steps.md); Reset clears it
- Reset clears them

## Labels that must stay
- Pre-test checklist is a reminder, not a safety certification

## Depends on
- Layouts, styles

## How to check
- Change a choice, reload, then Reset
