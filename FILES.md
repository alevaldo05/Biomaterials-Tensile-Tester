# File guide

Everything is in the project root except `data/`, which holds the content and settings you are most likely to edit. All files are hand-written and maintained; there are no generated files, dependencies, or build output in this repository.

## Pages

| File | Page |
|---|---|
| `index.html` | Homepage (must keep this name: web servers and GitHub Pages open it by default). |
| `learn.html` | Learn: Before you test, Background, and Glossary (words come from `data/text/learn.js`). |
| `about.html` | About: background on tensile testing, engineering materials vs. biomaterials, skin, Project status, Further reading, and references. |
| `help.html` | Help: Troubleshooting, Keyboard, and the numbered References list (words from `data/text/help.js`, entries from `data/references.js`). |
| `choose-test.html` | Choose a test: Uniaxial Tension or Stress Relaxation. |
| `test-uniaxial-tension.html` | Live Uniaxial Tension test page. |
| `test-stress-relaxation.html` | Live Stress Relaxation test page. |
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
| `styles.css` | every page | Shared styles, the four color themes, and the three font stacks. |
| `styles-looks.css` | every page | The four optional styles (Lab instrument, Clinical clean, Engineering drawing, Academic report). |
| `layouts.css` | every page | Styles for the five layouts and the Settings choices. |
| `display-settings.js` | every page | Applies the saved color theme, font, style, layout, text size, spacing, motion, and graph choices before the page appears; colors the browser-tab icon to match the selected theme; runs the Settings choices. |
| `layouts.js` | every page except `check-text.html` | Rearranges the page for the chosen layout (Start screen, Sidebar, Cards, Tabs, Reading) and makes the "Skip to main content" link move focus without changing the address hash. |
| `site-search.js` | every page with the header menu (not `404.html`) | The magnifying-glass search button to the right of Settings: opens a box, lists matching pages and sections from `data/search-index.js`, Up/Down/Enter/Esc work. Results open through `SiteUI.navigate` so the leave pop-up applies. Loaded after `layouts.js` so the Sidebar layout's menu gets it too. When it opens it hangs to the right of the button without moving the logo, title, or menu where the window has room; where it does not, it stays in the header row without wrapping it (the title beside the logo is hidden while it is open if the row is still too short). Nothing is saved. |
| `page-nav.js` | `help.html`, `about.html`, `settings.html` | Loaded after `layouts.js`. Adds a short "On this page" list on Help and About (only where the chosen layout has none), "Back to top" links, a "Jump to" list of setting groups on Settings. Nothing is saved. |
| `build-number.js` | every page with the header menu (not `404.html`) | Adds a small "Site version: <commit>" line at the foot of the page (under the note in the Sidebar layout). It reads the commit from the `?v=` the deploy adds to this script's address, so a plain local copy shows nothing. Loaded last. Nothing is saved. |
| `ui.js`, `ui.css` | every page with the header menu (not `404.html`) | Shared pop-up pieces (`window.SiteUI`): Tip (hover or focus; any `data-term` or `data-tip-id` element gets one), Site pop-up (`<dialog>`), Dismissible note. `ui.js` loads in `<head>` right after `display-settings.js`; `ui.css` is linked after `layouts.css`. The pre-test checklist is built on the pop-up. Nothing is saved. |
| `graph.js` | test, protocol, and Load Test pages | The graph engine (`window.TensileGraph`): plain SVG graph, readout, key results, region guides, key-result points, zoom and pan, Customize graph, PNG/SVG download, editable dimensions, CSV reading. The arrangement of the results (parameters under the graph on Load Test) is chosen by one `stacked` test near the top of its page template.; the File details section on Load Test and the Copy results button. |
| `report.js` | test pages, Load Test, the Calibration page, and the Learn page | The printable one-page report and the blank run sheet (opens the browser's print window; save as PDF there). On the graph pages it is loaded right after `excel-export.js`; on the Learn page it is loaded before `text.js`, which adds the "Print blank run sheet" button only when `report.js` is present. |
| `excel-export.js` | test, protocol, and Load Test pages | Builds the Excel (.xlsx) file in the browser (hand-written zip and XML, no library). Loaded right after `graph.js`; without it the Excel button is not shown. |
| `live.js` | both test pages | The setup shown one step at a time (step bar, Back/Next, "?" tips; the "Show all steps" switch restores the full layout, saved as `steps`), with one column per step (specimen, dimensions, test settings) with a message beside any entry that needs attention, USB connection (Web Serial), simulator, the review panel above Start, Start/STOP/Tare, the optional pre-test checklist pop-up, recording, auto-stop, CSV download.; the run status in the browser tab title; the STOP bar pinned to the bottom of the window while recording. Clicking a link inside the site while recording or with undownloaded data opens the site's "Leave without saving?" pop-up (`ui.js`), with STOP while recording; closing the tab, reload, and Back keep the browser's own box. |
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
| `data/device.js` | Tester message format and connection settings. **Draft**: a guess until the controller code exists. |
| `data/protocols.js` | Protocol text for each test (General only for now): status, steps, reasons to stop, specimen, equipment, settings, required results, metadata, limitations, and references. **Draft for advisor review**, not approved procedures. |
| `data/terms.js` | The definitions shown in the hover box (name, one-line definition, equation, unit). Wording is copied from the Glossary and the Governing equations tables; no new claims. Key results use the live definition the graph already builds, not this file. |
| `data/materials.js` | The materials list (46 materials in 7 families) with **typical, approximate, unreviewed** property ranges. Used by the Materials page, the protocol pages, and the test pages. Edit values here. |
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
| `docs/cards/features/` | One card per feature (graph engine, live test, simulator, USB link, downloads, print report, compare, calibration, materials, protocols, display settings, layouts, styles, site search, page text, deploy and checks). Same shape. |
| `FILES.md` | This guide. |
| `docs/DEPLOY.md` | How the site is published (GitHub Pages), the one-time setup, and how to tell when a deploy has finished. |
| `docs/BRANCHES.md` | Backups (tags), `main`, branch rules, and how to go back to a backup. |
| `docs/REPO-SETTINGS.md` | Checklist of repository settings only the owner can change on GitHub. |
| `.github/workflows/deploy.yml` | The workflow that publishes the site when `main` changes. Not part of the published site. |
| `.github/dependabot.yml` | Update checker for the Actions in the workflow, switched off (limit 0). Change the 0 to 2 to receive weekly update pull requests. Not part of the published site. |
| `scripts/build-site.sh` | Used by the workflow: copies the site, adds `?v=<commit>` to script and style links, writes `version.json`. Does not change the repository files. |
| `scripts/check-site.js` | Run by the workflow before every publish (and on pull requests): checks links, script syntax, data files, duplicates, the build output, that no email address or key is in any file, that every workflow Action is pinned to a full commit ID, that every page has the Content Security Policy tag and no inline scripts or handlers, that every page has a description and an icon, that every page except the 404 page starts with the skip link, and that every page has a card in `docs/cards/pages/` and every file or link a card names exists. Changes nothing. Run locally with `node scripts/check-site.js`. |
| `AGENTS.md` | Workflow rules for AI assistants. |
| `CLAUDE.md` | One line that loads `AGENTS.md` in Claude Code (name required by Claude Code). |

## To change…

| To change… | Edit |
|---|---|
| Messages to and from the tester, baud rate, auto-stop, point limit | `data/device.js` |
| Protocol steps, specimen sizes, equipment lists | `data/protocols.js` |
| Further reading links | `data/articles.js` |
| The description shown in search results | the `<meta name="description">` line in that page's HTML |
| Homepage text (About the tester, How it works, Protocols) | `index.html` |
| Before you test, Background, Glossary | `learn.html` |
| About page text, Project status, references | `about.html` |
| Colors, spacing, themes, fonts | `styles.css` |
| Styles (looks) | `styles-looks.css`, `display-settings.js` |
| The header logo (the "BTT" letters; its color follows the selected theme through `--accent`, and `--logo-ink` on the Lab style's dark header) | the same `<svg class="logo">` in each page's header, `.logo` in `styles.css` |
| Layouts | `layouts.css`, `layouts.js` |
| Graph drawing, key results (modulus, yield, UTS…), CSV reading | `graph.js` |
| Test page behavior, CSV download | `live.js` |

## Script order

Pages load scripts in this order, and the order matters: `display-settings.js` (in `<head>`), then `ui.js` (in `<head>`, every page with the header menu), then `data/*.js` (`materials.js` first, then `samples.js`, then `sample-models.js`; `terms.js` before `graph.js` and `calibration.js`), then `graph.js`, then `excel-export.js` (graph pages only), then the page script (`live.js`, `load-test.js`, `protocol-page.js`, or `further-reading.js`), then `layouts.js`, then `data/search-index.js` and `site-search.js` (every page with a header menu), and (on Help, About, and Settings only) last `page-nav.js`.
