# File guide

Everything is in the project root except `data/`, which holds the content and settings you are most likely to edit. All files are hand-written and maintained; there are no generated files, dependencies, or build output in this repository.

## Pages

| File | Page |
|---|---|
| `index.html` | Homepage (must keep this name: web servers and GitHub Pages open it by default). |
| `learn.html` | Learn: Before you test, Background, and Glossary (words come from `data/text/learn.js`). |
| `about.html` | About: background on tensile testing, engineering materials vs. biomaterials, skin, Project status, Further reading, and references. |
| `help.html` | Help: Troubleshooting, Keyboard, Tutorials, and the numbered References list (words from `data/text/help.js`, entries from `data/references.js`). |
| `choose-test.html` | New Test: says that tests on the tester are run in the tester app, and links to it (`app/`, a folder created only when the site is built for publishing), to the practice page, and to Load Test. (The file name is kept so Home's New Test button, the menu, and search keep working. The website's own live test pages and its USB connection were retired.) |
| `load-test.html` | Load Test: reopen an earlier CSV file in the browser, or compare several files. |
| `calibration.html` | Calibration: type known masses and the tester's readings, see the fitted line, errors and chart, and download a CSV record. Nothing is applied or saved. |
| `materials.html` | Materials: a grouped material dropdown, typical properties, a stiffness-vs-density chart, and an example graph per material. Links: `#al-6061` (material), `#al-6061/properties`, `#al-6061/chart`. |
| `protocol-uniaxial-tension.html` | Uniaxial Tension protocol (draft), in four tabs: Steps, Specimen and equipment, Report and notes, Example graph and equations. Links: `#skin` (material), `#skin/step-3` (a step), `#skin/graph` (a tab). |
| `protocol-stress-relaxation.html` | Stress Relaxation protocol (draft). |
| `settings.html` | Settings: color theme, font, layout, style, text size, spacing, motion, and graph line thickness, curve style, and grid. |
| `404.html` | Shown by GitHub Pages for a wrong address at any depth. Its links start with `/Biomaterials-Tensile-Tester/`; change that in this one file if the site is renamed or moved to its own domain. |
| `favicon.svg` | The browser-tab icon: the "BTT" letters on a rounded square in the default green. `display-settings.js` swaps in the selected theme's colors while a page is open (the 404 page keeps this green icon). |
| `favicon.png` | The same icon as a 64 px picture, for browsers that ignore SVG icons. It stays green; the script removes this link when it swaps in the colored icon. |

Each page has its own header, navigation, and text in its HTML. The interactive parts are drawn by the scripts below. The chosen layout rearranges what is already on the page; content is written only once.

Every page except `404.html` starts with a "Skip to main content" link (`.skip-link` in `styles.css`) that jumps to `<main id="main-content">`. Every page has a Content Security Policy `<meta>` tag in its `<head>`. It allows only this site's own files (plus `blob:` images for graph downloads), so pages must not use inline `<script>` blocks or `onclick=` attributes; put code in a `.js` file.

## Scripts and styles

| File | Used by | What it does |
|---|---|---|
| `styles.css` | every page | Shared styles (theme colors, text size, fonts, top bar, page, buttons, Settings), the seven color themes (green light and dark, purple light and dark, pink light and dark, MU colors), and the three font stacks. |
| `css/*.css` | every page | The page-specific styles that used to be in `styles.css`, split by their own section headings with the order unchanged: `graph.css` (graph pages), `test-setup.css` (test setup in steps), `home.css`, `protocol.css`, `live.css` (live test and Load Test), `about.css`, `materials.css`, `checklist.css`, `calibration.css`, `compare.css`, `report.css`, `extras.css` (page text, Help and Materials extras, Motion, Settings previews, data checks, version line), `guided.css` (guided test steps). **Every page links them all, in this order, right after `styles.css`** (the cascade depends on the order; `scripts/check-site.js` checks it). |
| `styles-looks.css` | every page | The four optional styles (Lab instrument, Clinical clean, Engineering drawing, Academic report). |
| `layouts.css` | every page | Styles for the five layouts and the Settings choices. |
| `display-settings.js` | every page | Applies the saved color theme, font, style, layout, text size, spacing, motion, and graph choices before the page appears; colors the browser-tab icon to match the selected theme; runs the Settings choices. |
| `layouts.js` | every page except `check-text.html` | Rearranges the page for the chosen layout (Start screen, Sidebar, Cards, Tabs, Reading) and makes the "Skip to main content" link move focus without changing the address hash. |
| `site-search.js` | every page with the header menu (not `404.html`) | The magnifying-glass search button to the right of Settings: opens a box, lists matching pages and sections from `data/search-index.js`, Up/Down/Enter/Esc work. Results open through `SiteUI.navigate` so the leave pop-up applies. Loaded after `layouts.js` so the Sidebar layout's menu gets it too. When it opens it hangs to the right of the button without moving the logo, title, or menu where the window has room; where it does not, it stays in the header row without wrapping it (the title beside the logo is hidden while it is open if the row is still too short). Nothing is saved. |
| `page-nav.js` | `help.html`, `about.html`, `settings.html` | Loaded after `layouts.js`. Adds a short "On this page" list on Help and About (only where the chosen layout has none), "Back to top" links, a "Jump to" list of setting groups on Settings. Nothing is saved. |
| `build-number.js` | every page with the header menu (not `404.html`) | Adds the footer line "Version 2.0" at the foot of the page (under the note in the Sidebar layout); on a deployed copy it adds " · build <commit>" (read from the `?v=` the deploy puts on this script's address). The release number is also in `scripts/build-site.sh` (`version.json`). |
| `load-shell.js` | Load Test | The Load Test workspace: moves the page's markup into a File sidebar and a workspace (toolbar, strip of facts from the loaded file, graph). Loaded before `load-test.js`. |
| `tutorials.js` | `help.html`, the practice page, Load Test, and Calibration | The tutorials (`window.Tutorials`): short animated illustrations of the screen drawn with SVG and CSS from `data/tutorials.js`. Each plays inline, on the page where you do the thing, under a "Watch how" button at a `tut-slot` marker (Play/Pause, Replay, Hide; still frames with Back and Next when Motion is Reduced). Also builds the list of links on the Help page. Hidden while a test is recording. Nothing is saved. |
| `help-coach.js` | the practice page, Load Test, and Calibration | The "Need help?" button and its card, and the hints that appear by themselves (a CSV that cannot be read, a field error that stays, a minute with no activity). Loaded right before the page script. Nothing is saved except the Settings choice "Help prompts" (`helpprompts`). |
| `ui.js`, `ui.css` | every page with the header menu (not `404.html`) | Shared pop-up pieces (`window.SiteUI`): Tip (hover or focus; any `data-term` or `data-tip-id` element gets one), Site pop-up (`<dialog>`), Dismissible note. `ui.js` loads in `<head>` right after `display-settings.js`; `ui.css` is linked after `layouts.css`. The pre-test checklist is built on the pop-up. Nothing is saved. |
| `graph-core.js` | practice, protocol, Load Test, and Materials pages | The graph's calculations (`window.TensileGraphCore`): display choices (stress unit, strain unit, digits), records, key results (modulus, yield, UTS, relaxation), key points and regions, data checks, dimension source, and CSV reading. No drawing. Loaded right before `graph.js`. |
| `graph.js` | practice, protocol, and Load Test pages | The graph engine (`window.TensileGraph`): plain SVG graph, readout, key results, region guides, key-result points, zoom and pan, Customize graph, PNG/SVG download, editable dimensions, CSV reading. The arrangement of the results (parameters under the graph on Load Test) is chosen by one `stacked` test near the top of its page template.; the File details section on Load Test and the Copy results button. |
| `report.js` | the practice page, Load Test, the Calibration page, and the Learn page | The printable one-page report and the blank run sheet (opens the browser's print window; save as PDF there). On the graph pages it is loaded right after `excel-export.js`; on the Learn page it is loaded before `text.js`, which adds the "Print blank run sheet" button only when `report.js` is present. |
| `excel-export.js` | practice, protocol, and Load Test pages | Builds the Excel (.xlsx) file in the browser (hand-written zip and XML, no library). Loaded right after `graph.js`; without it the Excel button is not shown. |
| `live.js` | `practice.html` only | The practice page's test screen: the setup shown one step at a time (step bar, Back/Next, "?" tips; the "Show all steps" switch restores the full layout, saved as `steps`), with one column per step (specimen, dimensions, test settings) with a message beside any entry that needs attention, the connection to the simulator (no USB), the review panel above Start, Start/STOP/Tare, the optional pre-test checklist pop-up, recording, auto-stop, CSV download.; the run status in the browser tab title; the STOP bar pinned to the bottom of the window while recording. Clicking a link inside the site while recording or with undownloaded data opens the site's "Leave without saving?" pop-up (`ui.js`), with STOP while recording; closing the tab, reload, and Back keep the browser's own box. |
| `live-links.js` | the practice page | Makes the simulator link (`SimLink` from `live-sim.js`) with `LiveLinks.create`; the shared interface is `open()`, `send(line)`, `close()`, `onLine`, `onClose`. There is no USB link: the website never opens a serial port. Loaded before `live.js`. |
| `live-shell.js` | the practice page | The workspace layout: moves the markup `live.js` builds into a Setup sidebar and a workspace (toolbar, measurement strip, graph); the sidebar fold and drawer. Loaded before `live.js`. |
| `live-material.js` | the practice page | The Material box with a small drop-down of ready choices. Loaded before `live.js`. |
| `css/workspace.css` | every page | The workspace layout, toolbar, strip, drawer, Material drop-down and dialog styles (used by the practice page and Load Test). |
| `live-sim.js` | practice page only | The labeled simulator, `SimLink` (`window.LiveSim`), the only link to anything that looks like a tester. Loaded after `live-links.js`, which asks for it. |
| `practice.html`, `practice-pick.js` | practice page | The practice test (simulator only, no USB), reached from New Test and from Learn. `practice-pick.js` picks Uniaxial Tension or Stress Relaxation from the address before `live.js` runs. |
| `live-checklist.js` | the practice page | The optional pre-test checklist pop-up (`LiveChecklist.create`), built on the shared pop-up. Loaded before `live.js`. |
| `live-csv.js` | the practice page | The downloaded CSV: file name, header lines, and data rows (`LiveCsv.create`). Loaded before `live.js`. |
| `load-test.js` | `load-test.html` | Mode switch, test type, and file picker for Load Test, and opening files dropped onto the page (a dashed frame shows while dragging). |
| `compare.js` | `load-test.html` | Compare several files: overlay graph, key results with mean and standard deviation, summary CSV, Copy summary. Uses `graph.js` for the numbers. |
| `calibration.js` | `calibration.html` | The calibration table, least-squares fit, chart, CSV record, Copy results, and the one-page print report (built with `report.js`). |
| `materials.js` | `materials.html` | The Material tab (details, the Test parameters card beside them, and the example graph), the sortable properties tables with a two-material comparison, and the chart with its filters and list. It passes `paramsHost` to `graph.js` so the Test parameters are built in their own card. |
| `material-combobox.js` | `materials.html` | Makes the Material dropdown a box you can type into: the list narrows to matching names; Up, Down, Enter, and Esc work. The real dropdown stays hidden in the page, so `materials.js` still reads its value. Loaded just before `materials.js` or `protocol-page.js`. |
| `protocol-page.js` | both protocol pages | Material choice (General, or "To be added at a later date"), the four tabs, the Steps tab with its jump list and per-step links, and the example graph. |
| `further-reading.js` | `about.html` | Builds the Further reading list. |

## `data/` (content and settings)

| File | What it holds |
|---|---|
| `data/checklist.js` | The items in the optional pre-test checklist pop-up (same wording as "Before you test" on the Learn page). **Draft** wording for the advisor to review. |
| `data/device.js` | The line format of the practice page's simulator (what it emits and parses). It serves only the simulator and is **not** the tester app's protocol (that is in `docs/app/PROTOCOL.md`). Values are kept as they were because `packages/core/reference` reads this file. |
| `data/protocols.js` | Protocol text for each test (General only for now): status, steps, reasons to stop, specimen, equipment, settings, required results, metadata, limitations, and references. **Draft for advisor review**, not approved procedures. |
| `data/help-tips.js` | The times for the hints (a CSV that cannot be read, a field error that stays, a minute without activity) and which Troubleshooting row (in `data/text/help.js`) each problem shows. Listed after `data/text/help.js` on the pages that use it. |
| `data/tutorials.js` | The tutorials: captions (draft wording for review), the simplified screen drawn for each, and the frames. `scripts/check-site.js` checks every id a frame names. |
| `data/terms.js` | The definitions shown in the hover box (name, one-line definition, equation, unit). Wording is copied from the Glossary and the Governing equations tables; no new claims. Key results use the live definition the graph already builds, not this file. |
| `data/materials.js` | The materials list (46 materials in 7 families) with **typical, approximate, unreviewed** property ranges. Used by the Materials page, the protocol pages, and the practice page. Edit values here. |
| `data/sample-models.js` | Builds an example curve in the browser for each material that has no hand-made curve, from its typical mid-range values. **Shapes, not data**; labeled "Sample data, not measured". |
| `data/samples.js` | Sample curves for skin, mild steel, and concrete (both tests), labeled "Sample data, not measured". Used by the protocol pages, "Fill example values", and the simulator. **Uncertain:** the script that generated this file is not in the repository. |
| `data/articles.js` | Further reading links for the About page (empty for now). |

## Documentation

| File | Purpose |
|---|---|
| `README.md` | What the site is, how to run it, settings, safety. |
| `EDITING-TEXT.md` | Plain-language guide to editing the page words in `data/text/`. |
| `check-text.html` | Checks the text files and says what to fix. Uses `check-text.js` and `text.js`. |
| `check-text-errors.js` | Loads first on `check-text.html` and records which text file has a typing mistake, so the checker can name it. A separate file because pages allow no inline scripts. |
| `text.js` | Fills Home, Learn, and About from the files in `data/text/`. Shows a visible box if a text file has a mistake. |
| `data/text/home.js`, `learn.js`, `about.js`, `help.js` | The words for Home, Learn, About, and Help. Edit these to change a paragraph. |
| `data/search-index.js` | The places the site search can find: one line each with a name, the page, the part of the page, a label, and extra words. Edit by hand when a page or section changes; `scripts/check-site.js` tests that every page and part exists. |
| `data/references.js` | The 37 numbered references shown on the Help page. Supplied by the owner's research; not independently opened or verified. |
| `PROJECT-SUMMARY.md` | Short summary of the project, the page and feature card lists, the fixed rules, and "to change X, open card Y". Start here. |
| `docs/cards/pages/` | One card per web page: purpose, files in load order, what the user sees, behavior to keep, labels that must stay, dependencies, how to check. Update the card in the same change as the page. |
| `docs/cards/features/` | One card per feature (graph engine, live test, simulator, USB link (retired), downloads, print report, compare, calibration, materials, protocols, display settings, layouts, styles, site search, page text, deploy and checks). Same shape. |
| `FILES.md` | This guide. |
| `docs/DEPLOY.md` | How the site is published (GitHub Pages), the one-time setup, and how to tell when a deploy has finished. |
| `docs/BRANCHES.md` | Backups (tags), `main`, branch rules, and how to go back to a backup. |
| `docs/REPO-SETTINGS.md` | Checklist of repository settings only the owner can change on GitHub. |
| `.github/workflows/deploy.yml` | The workflow that publishes the site when `main` changes. Not part of the published site. |
| `docs/app/FEATURE-STATUS.md` | What in the tester app is implemented, simulated, untested, not built, and unsupported. |
| `docs/app/CONTAINERS.md` | Running everything in containers: the five services, first start, updating one part alone, backups, moving to the lab computer. |
| `docs/app/BACKEND.md` | The back end: what the database stores, roles, the API, settings, running it, moving it to the lab computer. |
| `docs/app/SETUP.md` | From the board to a recorded test: what is not yet verified, electrical restrictions, where pins, drivers, settings, and calibration are configured, building the firmware, and what the app's messages mean. |
| `docs/app/GUIDE-pico.md`, `docs/app/GUIDE-raspberry-pi-service.md` | How a Raspberry Pi Pico or a Raspberry Pi service would speak the same protocol (planned; nothing built). |
| `docs/app/PROTOCOL.md` | The acquisition protocol (the project's own; not a manufacturer protocol): messages, requests, and what the app does when data is bad. |
| `docs/app/ARCHITECTURE.md` | The design of the tester app, shared packages, back end, and containers, and what works today. |
| `.github/workflows/app.yml` | Checks for the app workspace: every test in a clean container, then builds and starts the containers. Publishes nothing. Not part of the published site. |
| `.github/dependabot.yml` | Update checker for the Actions in the workflow, switched off (limit 0). Change the 0 to 2 to receive weekly update pull requests. Not part of the published site. |
| `scripts/build-site.sh` | Used by the workflow: copies the site, adds `?v=<commit>` to script and style links, writes `version.json`. Does not change the repository files. |
| `scripts/check-combinations.js` | An optional, slower check you run by hand (`node scripts/check-combinations.js`, or `--quick` for a sample). It needs Playwright installed on your computer (`npm install playwright`), which this project does not install, so it is **not** part of `check-site.js` and the publish workflow does not run it. It starts its own small web server for this folder and, in a real browser, loads every page under every color theme × layout × style (175), plus a pairwise set that covers every pair of values of all 16 display choices, at 1280 px and 1024 px. It looks for console errors, failed requests, sideways scroll, a clipped title, an overlapping header, low text contrast, a missing focus ring, and runs each page's main feature (a simulated test with STOP and the CSV download on the practice page, the New Test links, Load Test with one file and several, Calibration, Materials, the protocols, Settings, a Help tutorial, search, the text checker). Prints FAIL (a bug) and WARN (contrast to review). Changes nothing. |
| `scripts/shared-files.js` | The one list of website files the tester app shares (definitions, materials, and the calculation scripts its reference tests run) and a SHA-256 hash of them, with line endings made LF first. `node scripts/shared-files.js` prints the list and the hash; the app's Help screen shows the first 12 characters of the hash it was built with. Used by the app's build and its tests; not part of the published site. Changes nothing. |
| `scripts/check-site.js` | Run by the workflow before every publish (and on pull requests): checks links, script syntax, data files, duplicates, the build output, that no email address or key is in any file, that every workflow Action is pinned to a full commit ID, that every page has the Content Security Policy tag and no inline scripts or handlers, that every page has a description and an icon, that every page except the 404 page starts with the skip link, and that every page has a card in `docs/cards/pages/` and every file or link a card names exists. Changes nothing. Run locally with `node scripts/check-site.js`. |
| `AGENTS.md` | Workflow rules for AI assistants. |
| `CLAUDE.md` | One line that loads `AGENTS.md` in Claude Code (name required by Claude Code). |

## Tester app workspace (not part of the published website)

| File or folder | Purpose |
|---|---|
| `package.json`, `package-lock.json` | The workspace for the tester app and its packages, and the tools they use (TypeScript, Vitest). Run `npm install` once, then `npm test`. The website pages need none of it. |
| `tsconfig.json`, `tsconfig.base.json`, `vitest.config.mjs` | Settings for TypeScript and the test runner. |
| `.gitignore` | Keeps `node_modules/` and build output out of the repository. |
| `packages/core/` | Shared calculations and file formats in TypeScript (`src/`): key results, data checks, the CSV reader and writer, the Excel writer, the calibration fit, and comparison statistics, ported from the website's scripts. `test/` checks them against the website's results. `reference/` runs the website's own `graph-core.js`, `live-csv.js`, and the maths in `calibration.js` and `compare.js` on fixed inputs and compares the results with `reference/fixtures/reference.json` (and `xlsx-reference.json` for the Excel bytes). |
| `packages/protocol/` | The acquisition protocol between the app and the project's own devices: message shapes, run-time checks, and the line framer. Described in `docs/app/PROTOCOL.md`. |
| `packages/acquisition/` | The common acquisition interface (`src/types.ts`), the connection logic (`src/source.ts`), the protocol adapter (`src/adapters/`), and the transports (`src/transports/`: simulator, recorded-data replay, USB serial). |
| `packages/machine-control/` | The machine-control interface. Its only implementation answers "unsupported" and transmits nothing. |
| `packages/recording/` | The recorder, the conversion from ADC counts to physical values, calibration compatibility, and the acceptance tests (`test/acceptance.test.ts`). |
| `packages/ui/` | Shared React pieces: the graph (`src/Graph.tsx`, with its arithmetic in `src/graph-math.ts`), the measurement strip, status bar, panels, and form fields. |
| `apps/tester/` | The app. `src/controller.ts` wires a source to the recorder; `src/App.tsx` is the screen; `src/exports.ts` builds the saved files; `src/real.ts` is the only file that reaches for hardware (lab edition only); `src/app.css` holds the look (the website's green light and dark colors). Run with `npm run app`, build with `npm run app:build`. |
| `apps/api/` | The back end (Fastify, PostgreSQL). `src/app.ts` holds every route; `src/auth.ts` passwords and sign-in; `src/schemas.ts` the checks on what browsers send; `src/db.ts` the connection and migrations; `migrations/` the numbered database changes; `src/server.ts` starts it; `src/cli.ts` creates the first admin. `test/` runs it against a throwaway PostgreSQL. |
| `deploy/` | Containers: `compose.yml` (gateway, web, app, api, db), one `Dockerfile` per service, `gateway/nginx.conf` (routes `/`, `/app/`, `/api/`), `.env.example` (copy to `.env`, never committed), `backup.sh`, and `test/Dockerfile` (runs every check in a clean container). |
| `.dockerignore` | Keeps installs, build output, and Git data out of image builds. |
| `apps/tester/src/Shell.tsx`, `lab-api.ts`, `pages/` | The app's header, sign-in, and page switching; its client for the back end; the History and Admin pages. |
| `apps/tester/site-data.ts` | Reads the website's `data/terms.js` and `data/materials.js` when the app is built, so the app shows the same definitions and materials. |
| `tsconfig.web.json` | TypeScript settings for the parts that run in a browser page. |
| `firmware/common/` | Firmware code shared by every board, plain C++ with no Arduino calls: `ads1115_driver.*` (ADS1115 register work), `protocol.*`, `acquisition_core.*`; `library.json` lets PlatformIO build it. `test/host/` builds it for a computer with a pretend ADS1115 and runs its unit tests (`build-and-test.sh`). |
| `firmware/esp32-ads1115/` | The ESP32 + ADS1115 board folder (PlatformIO): `platformio.ini`, `include/board_config.h` (the only file with pins, the I2C address, and channel wiring; all example values), and `src/main.cpp` (the chip-specific code in one marked block). |
| `firmware/README.md` | Firmware layout, the host tests, and how to add another board. |
| `packages/`, `apps/`, `firmware/`, `deploy/` | The app, its packages, the back end, device-side software, and container files. `scripts/check-site.js` and `scripts/build-site.sh` leave them alone and out of the published site. |

## To change…

| To change… | Edit |
|---|---|
| The simulator's line format, auto-stop, point limit | `data/device.js` |
| Protocol steps, specimen sizes, equipment lists | `data/protocols.js` |
| Further reading links | `data/articles.js` |
| The description shown in search results | the `<meta name="description">` line in that page's HTML |
| Homepage text (About the tester, How it works, Protocols) | `index.html` |
| Before you test, Background, Glossary | `learn.html` |
| About page text, Project status, references | `about.html` |
| Colors, spacing, themes, fonts | `styles.css` |
| The look of one page or feature (graph, live test, Materials, Calibration, Compare, report, guided steps...) | its file in `css/` |
| Styles (looks) | `styles-looks.css`, `display-settings.js` |
| The header logo (the "BTT" letters; its color follows the selected theme through `--accent`, and `--logo-ink` on the Lab style's dark header) | the same `<svg class="logo">` in each page's header, `.logo` in `styles.css` |
| Layouts | `layouts.css`, `layouts.js` |
| Graph drawing, key results (modulus, yield, UTS…), CSV reading | `graph.js` |
| Practice page behavior, CSV download | `live.js` |
| Where New Test sends people | `choose-test.html` |

## Script order

Stylesheets: every page links `styles.css`, then `css/graph.css`, `css/test-setup.css`, `css/home.css`, `css/protocol.css`, `css/live.css`, `css/about.css`, `css/materials.css`, `css/checklist.css`, `css/calibration.css`, `css/compare.css`, `css/report.css`, `css/extras.css`, `css/guided.css`, then `styles-looks.css`, `layouts.css`, `ui.css` (the 404 page links the first fourteen with the full site address). Do not reorder them.

Pages load scripts in this order, and the order matters: `display-settings.js` (in `<head>`), then `ui.js` (in `<head>`, every page with the header menu), then `data/*.js` (`materials.js` first, then `samples.js`, then `sample-models.js`; `terms.js` before `graph.js` and `calibration.js`), then `graph-core.js`, then `graph.js`, then `excel-export.js` (graph pages only), then the page script (`live.js`, `load-test.js`, `protocol-page.js`, or `further-reading.js`), then `layouts.js`, then `data/search-index.js` and `site-search.js` (every page with a header menu), and (on Help, About, and Settings only) last `page-nav.js`.
