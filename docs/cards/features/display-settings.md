# Display settings and themes

Feature card. Update it in the same change as the feature.

## Purpose
Saved display choices and the seven color themes (green light, green dark, purple light, purple dark, pink light, pink dark, MU colors).

## Files
- `display-settings.js` (the `SETTINGS` table)
- `settings.html`
- CSS: variable blocks at the top of `styles.css`

## What the user sees
- Settings page choices; theme colors the tab icon

## Behavior to keep
- Stored names `light`, `dark`, `purple`, `pink` stay (new: `purple-dark`, `pink-dark`, `mu`)
- The MU colors theme is colors only (no logo, seal, or wordmark; not called official). Its values (Manhattan Green `#046A38`, gold `#F5A800` as a header underline accent) come from the project plan and are UNVERIFIED; compare with the official guidelines before relying on them
- Saved in this browser only; appearance only
- Help prompts (key `helpprompts`: `on` default, `off`) turn the automatic hints off; see [help-coach](help-coach.md)
- Also saved by the test pages (not on the Settings page): key `steps` (`guided`, `all`), see [guided-steps](guided-steps.md); Reset clears it
- Reset clears them

## Labels that must stay
- Pre-test checklist is a reminder, not a safety certification

## Depends on
- Layouts, styles

## How to check
- Change a choice, reload, then Reset
