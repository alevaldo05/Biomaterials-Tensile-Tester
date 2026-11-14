# Get the App (choose-test.html)

Page card. Update it in the same change as the page.

## Purpose
The page after the **Get the app** button on Home. The website no longer has live test pages: tests on the tester are run in the separate tester app. This page says so and sends people to the right place: the tester app, the practice page, or Load Test. (The file keeps its old name so Home's link, the menu, and search keep working.)

## Files
- HTML: `choose-test.html` (heading `Get the App`, sections `app-title` and `here-title`)
- Scripts in order: `display-settings.js`, `ui.js` (head), `layouts.js`, `data/search-index.js`, `site-search.js`, `build-number.js`
- CSS: the shared styles (`.btn`, `.btn-secondary`, `.actions`, `.section`)

## What the user sees
- Heading **Get the App** and a sentence: tests on the tester are run in the tester app, a Windows app installed on the lab computer; this website is for learning, protocols, materials, and reopening saved files
- A primary link **Download the tester app (beta)** to `https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases/latest`, the line "For Windows. Beta.", and a sentence: real tests are run in the tester app installed on the lab computer, which connects over USB
- A link **Practice with a simulated test** to `practice.html` and a link to **Load Test** (`load-test.html`, which also opens CSV files saved by the tester app); links to the two draft protocols

## Behavior to keep
- The tester app is not published on GitHub Pages. The download link shows a release only after the owner publishes one (the app's draft releases are not visible to the public)
- Do not link to `.md` files from this page (they are not published); describe `docs/app/CONTAINERS.md` and `docs/app/SETUP.md` in words only
- Never present simulated data as measured; nothing on this page is called an emergency stop

## Labels that must stay
- "Simulated data, not measured" (for the practice page's data); the browser tab title is "Get the App – Biomaterials Tensile Tester"

## Depends on
- Pages: index, practice, load-test, protocol-uniaxial-tension, protocol-stress-relaxation
- The tester app (see the [tester-app](../features/tester-app.md) card)

## How to check
- `node scripts/check-site.js`
- Open the page at 1280, 1024, 768, and 390 px: the title wraps without clipping or sideways scrolling; the three links are present and the practice and Load Test links open their pages
