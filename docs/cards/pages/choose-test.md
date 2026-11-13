# New Test (choose-test.html)

Page card. Update it in the same change as the page.

## Purpose
The page after the **New Test** button on Home. The website no longer has live test pages: tests on the tester are run in the separate tester app. This page says so and sends people to the right place: the tester app, the practice page, or Load Test. (The file keeps its old name so Home's link, the menu, and search keep working.)

## Files
- HTML: `choose-test.html` (heading `New Test`, sections `app-title` and `here-title`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- CSS: the shared styles (`.btn`, `.btn-secondary`, `.actions`, `.section`)

## What the user sees
- Heading **New Test** and a sentence: tests on the tester are now run in the tester app; this website is for learning, protocols, materials, and reopening saved files
- A primary link **Open the tester app** to `app/`, and, under it, a plain sentence: on this public website the app runs simulations and replays only; connecting to the tester over USB is done in the app installed on the lab computer
- A link **Practice with a simulated test** to `practice.html` and a link to **Load Test** (`load-test.html`, which also opens CSV files saved by the tester app); links to the two draft protocols

## Behavior to keep
- `app/` is a relative link to a folder that does not exist in this repository: `scripts/build-site.sh` adds it only when the site is built for publishing (on GitHub Pages it is the app's learning edition with simulated data only; on the lab computer it is the full app behind the gateway). Locally, with `python3 -m http.server`, the link shows "not found" until the app is built. `scripts/check-site.js` accepts exactly `app/` and `app/index.html` as such links
- Do not link to `.md` files from this page (they are not published); describe `docs/app/CONTAINERS.md` and `docs/app/SETUP.md` in words only
- Never present simulated data as measured; nothing on this page is called an emergency stop

## Labels that must stay
- "Simulated data, not measured" (for the practice page's data); the browser tab title is "New Test – Biomaterials Tensile Tester"

## Depends on
- Pages: index, practice, load-test, protocol-uniaxial-tension, protocol-stress-relaxation
- The tester app (see the [tester-app](../features/tester-app.md) card)

## How to check
- `node scripts/check-site.js`
- Open the page at 1280, 1024, 768, and 390 px: the title wraps without clipping or sideways scrolling; the three links are present and the practice and Load Test links open their pages
