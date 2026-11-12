# Biomaterials Tensile Tester

The website for a senior design project: a tensile tester for biological materials such as skin. It runs in the browser on a computer and connects to the tester over USB.

- **New Test** → Choose a test → Uniaxial Tension or Stress Relaxation. The test page starts empty, connects to the tester over USB (there is no simulator on the real pages; the labeled simulator is on the **practice page**, reached from Learn), sends Start, STOP, and Tare, and plots readings live. The setup is in numbered steps (specimen, dimensions in mm, test settings, connection, review): by default one step is shown at a time with Back and Next, and the "Show all steps" switch at the top right shows them all at once (saved in this browser, key `steps`: `guided` default, `all`; Settings → Reset clears it). STOP is always shown. Short "?" buttons hold the helper text. The Dimensions and Test settings steps each have a small **Fill example** link that fills only that step, so you choose step by step between the example values and your own. a message beside an entry says what to fix, and a Review panel above Start lists every value with its unit, whether the dimensions are typed or example values, and the connection mode. Start stays unavailable until you connect or choose the simulator. It downloads the data as CSV (opens in Excel) and the graph as PNG or SVG. The page reads top to bottom: the setup card (specimen, dimensions, test settings), the connection and run controls with the review above Start, then the graph with its buttons underneath and Readout and Key results beside it (under it in a narrow window or at large text). While a test runs the browser tab title starts with "Recording ·", and after it stops with "Stopped ·", so a run can be seen from another tab.
- **Load Test** reopens an earlier CSV file in the browser only. Nothing is uploaded or saved. You can choose a file or drop it anywhere on the page (in Compare mode, up to 12 files at once); a closed **File details** section lists what the file says about the test (specimen ID, material, date, speed, notes, how it ended) as plain text, and is hidden for files without such notes. Its **Compare several files** mode takes up to 12 CSV files of one test type, overlays their curves (each with its own color and line style), and tabulates the same key results as the single-file graph for every specimen with a mean, a sample standard deviation (n − 1), and n. It warns when files mix simulated and non-simulated data, mix materials, or lack saved dimensions, and downloads a summary CSV (MPa, s, %, MJ/m³).
- **Materials** is its own page: a grouped dropdown of 46 materials (metals including steel and stainless grades, plastics, rubbers, concrete and ceramics, wood, composites, and biomaterials such as skin, tendon, and bone), their typical properties, a Young's modulus vs density chart, and an example graph for each. The chart has filters (family, very approximate materials, a name search, names, family outlines) and a list of the materials shown; the chart is one Tab stop, and the arrow keys move between materials. **All values are typical, approximate, and unreviewed**, not measured and not from one named table. For skin, mild steel, and concrete the example curves are the project's earlier sample curves; for every other material the curve shape is built in the browser from typical mid-range values, is not data, and is labeled "Sample data, not measured".
- **Calibration** compares force readings you type in (from the test page) with known masses (F = m·g, using g = 9.80665 m/s², editable), fits reading = gain × force + offset by least squares, shows the errors, a chart and a "suggested correction (not applied by this site)", and downloads a CSV record or prints a one-page report (Draft-labeled, with the same cautions). It changes no reading anywhere, makes no claim of traceability or of meeting a standard, and saves nothing. A tolerance flag appears only if you enter a tolerance. The "Fill example values" button fills numbers that are labeled "Example numbers, not measured". Tare is not a calibration.
- **Protocols** pages show the General draft procedure, in four tabs: **Steps** (with a "Jump to step" list, links from each step to the related parts, and a copyable link per step), Specimen and equipment, Report and notes, and an example graph from labeled sample data with the governing equations. The Material list has two choices: General, and "To be added at a later date" (which shows the General text with a note). Nothing is saved; the position is kept only in the link (for example `#general/step-3`).
- **Search:** a magnifying-glass button to the right of Settings in the header opens a search box. The box hangs to the right of the button without moving anything else in the header (on a narrow window it stays in the header row instead). Typing lists matching pages and sections (from `data/search-index.js`); Up and Down move through the results, Enter opens one, and Esc closes the box (on a test page it does not send STOP). Nothing is saved. Help, About, and Settings have short jump lists.
- **Learn** has Before you test, Background, and the Glossary. **About** explains tensile testing and holds Project status, Further reading (add links in `data/articles.js`), and references.
- **Settings** has an optional **Pre-test checklist** (Off by default) and display choices (text size, spacing, motion, graph line thickness, curve style, and grid, plus four more): color theme (green light, green dark, purple light, purple dark, pink light, pink dark, and MU colors), font (Serif, Clean sans, Humanist sans), layout (Start screen, Sidebar, Cards, Tabs, Reading), and style (Standard, Lab instrument, Clinical clean, Engineering drawing, Academic report). They change appearance only.

Status: **draft**. The real machine has never been connected, the controller code does not exist yet, and the message format in `data/device.js` is a guess. Simulator output is labeled "Simulated data, not measured"; sample data is labeled "Sample data, not measured".

It is plain HTML, CSS, and JavaScript: no framework, no dependencies, no install step, and no build step. See [FILES.md](FILES.md) for what each file does.

## Safety

While a test is recording, the same STOP button is also pinned to the bottom of the window with the words "Not an emergency stop." The on-screen STOP button (and the Esc key) is **not** an emergency stop. The machine needs its own physical emergency-stop button that cuts motor power even if the computer, browser, or cable fails. The controller should also stop the motor if it stops receiving the `PING` heartbeat during a test.

## Requirements

- **Chrome on a computer (Windows or Mac)** to connect to the tester. USB uses the browser's Web Serial feature, which Safari and phones do not have. **Safari on a Mac** is also a target for everything else (the simulator, graphs, protocols, Materials, Load Test, downloads). Firefox and Edge are not targets and are not checked. So far the pages have only been checked in Chrome's engine (Chromium) on Linux, not in Safari or on a real Windows computer.
- **Python 3** (or any other simple web server) to preview the site locally. Not strictly required; see below.

## Run it locally

Get the code (or download the ZIP from GitHub and extract it), then go into the project folder:

```bash
git clone https://github.com/alevaldo05/Biomaterials-Tensile-Tester.git
```

```bash
cd Biomaterials-Tensile-Tester
```

Start a local web server. On Mac or Linux:

```bash
python3 -m http.server 8000
```

On Windows:

```bash
py -m http.server 8000
```

Then open <http://localhost:8000/> in Chrome (or Safari). Press Ctrl+C in the terminal to stop the server.

To preview a pull request branch, run these first, replacing `<branch>` with the branch name:

```bash
git fetch origin
```

```bash
git checkout <branch>
```

Double-clicking `index.html` also works in Chrome, but the display settings may not carry between pages that way. The local server is the most reliable option, and USB works from `http://localhost` in Chrome.

## Settings

There are no environment variables, accounts, or keys. The settings are:

| Setting | Where | Notes |
|---|---|---|
| Color theme | Settings page | Saved in this browser only (localStorage key `theme`: `light`, `dark`, `purple`, `pink`, `purple-dark`, `pink-dark`, `mu`; the first four are Green light, Green dark, Purple light, Pink light, so earlier choices keep working). MU colors uses Manhattan University's colors only (no logo, seal, or wordmark); its values come from the project plan and are unverified. |
| Font | Settings page | Saved in this browser only (key `font`: `serif` (default), `sans`, `humanist`). Uses fonts already on the computer (nothing is downloaded), so the look differs a little between Windows, Mac, and other systems. Applies in every style, to graph text, and to downloaded PNG/SVG graphs. Appearance only. |
| Layout | Settings page | Saved in this browser only (key `layout`: `start`, `sidebar`, `cards`, `tabs`, `reading`). Appearance only. |
| Text size | Settings page | Saved in this browser only (key `textsize`: `100` (default), `125`, `150`, `200`). Multiplies the browser's own text size. Appearance only. |
| Spacing | Settings page | Saved in this browser only (key `spacing`: `standard` (default), `comfortable`, `compact`). Changes gaps and padding between blocks, not controls. |
| Motion | Settings page | Saved in this browser only (key `motion`: `system` (default), `reduced`, `standard`). Affects only button fades and the step highlight flash. |
| Graph line thickness, curve style, grid | Settings page | Saved in this browser only (keys `linewidth`: `3` (default), `1.5`, `2`, `4`; `curve`: `line` (default), `markers`; `grid`: `major` (default), `off`, `minor`). The starting look of the main graph; the controls under a graph change that graph only and are not saved. |
| Stress unit, strain unit, displayed digits | Settings page | Saved in this browser only (keys `stressunit`: `mpa` (default, GPa for large values), `kpa`; `strainunit`: `ratio` (default), `percent`; `digits`: `standard` (default), `4`, `5`). They change only how numbers are written on the main graph pages, the graph images, and the printed report. Calculations, the CSV, and the numeric columns of the Excel data sheet stay in base units. Modulus is always stress per 1 of strain, and energy density stays in MJ/m³. |
| Help prompts | Settings page | On by default; saved in this browser only (key `helpprompts`: `on`, `off`). Off stops the small hints that appear by themselves on the test pages, Load Test, and Calibration; the **Need help?** button stays. Times and wording sources are in `data/help-tips.js`. |
| Pre-test checklist | Settings page | Off by default; saved in this browser only (key `checklist`: `off`, `on`). When On, pressing Start on a test page opens a pop-up with the "Before you test" items (tissue items only for biological materials), and Start stays disabled until every item shown is ticked. A reminder, not a safety certification; the ticks are never saved. Items are in `data/checklist.js`. It changes only what appears before a test starts, never test data, results, or what is sent to the tester. |
| Style | Settings page | Saved in this browser only (key `style`: `standard`, `lab`, `clinical`, `drafting`, `academic`). With Green light, each style uses its own colors; other themes keep theme colors. |
| Tester connection | `data/device.js` | Baud rate (115200), line ending, column order, units, command text, PING interval, break detection, 200,000-point limit. **Draft:** edit this file to match the controller once its code exists. |
| Protocol text | `data/protocols.js` | Draft placeholders. Text in `[square brackets]` is highlighted as still to be decided. |
| Further reading | `data/articles.js` | Empty until links are added. Only `http://` and `https://` links are shown. |

Test data is never saved by the site. It stays in the browser tab until you download it, and the page warns before you leave with data that hasn't been downloaded (clicking a link in the site opens the site's own "Leave without saving?" pop-up, with a STOP button while recording; closing the tab, reloading, or Back shows the browser's own box, which a site cannot restyle).

## Tester message format (draft)

Defined in `data/device.js`; USB serial at 115200 baud, one text line per message, ending in `\n`.

- Controller → website: `time_ms,force_N,displacement_mm` (for example `1250,12.84,0.625`); `DONE` when a test finishes on its own; `ERR <message>` for a fault.
- Website → controller: `START,UNIAXIAL,<speed mm/min>`; `START,RELAX,<speed mm/min>,<hold mm>,<hold s>`; `STOP`; `TARE`; and `PING` every second during a test.

Tested with the practice page's simulator and with a fake serial port in test scripts only, not with the real machine.

## Downloaded CSV

The file starts with `#` lines holding the test details (test, source, material, dimensions, speed, notes), followed by the columns `time_s, force_N, displacement_mm, strain, stress_MPa`. Load Test reads these files back, including their dimensions. Excel set to a comma decimal separator (common outside the US) may need *Data → From Text/CSV* to read it correctly.

## Hold-start stress (stress relaxation)

The Key results give two stresses for the start of the hold. **Ramp-peak stress, σ₀** is the highest stress in the record, and percent relaxed, the apparent stress/strain ratio, and the decay time still use it. **Hold-start stress** is the stress at the first reading where displacement (measured from the first reading) reaches 98% of the hold displacement, the same moment the live auto-stop uses. The two differ if the stress overshoots during the ramp. The hold displacement is the typed value, or for a loaded file the "hold displacement" header or the middle value of its displacement column, and the definition says which. Without a displacement column, without a hold target, or if displacement never reaches 98% in the record, the row reads "not available" and gives the reason. The CSV header gets a `# Hold start,...` line, and the comparison summary gets a `hold_start_stress_MPa` column.

## Modulus estimate and its fitted interval

The automatic modulus estimate is the largest least-squares slope of stress against strain over a moving window of points (5 points up to 300 points, otherwise the point count divided by 60). Only windows that end at or before the peak stress are searched, so data after the peak, such as a dip and a steeper re-rise, cannot win. The Key results definition states the fitted interval (first and last strain and the number of points), and the same text is written to the CSV header (`# Modulus fit interval,...`), the Excel details sheet, and the printed report. If there are too few points up to the peak for one window, no modulus is reported and the 0.2% offset yield reads "—". Load Test recalculates the interval from the data and ignores the CSV line.

## Dimension source

A **Dimensions** line under the graph says where the specimen dimensions came from: typed by the user, example values (not measured), read from the file, example values as declared in the file, example values assumed because the file had none, entered on the page after loading, or not needed (stress and strain given). Example values are shown as a warning. This is labeling only: it does not change any result or block a test. The same text is written to the CSV header (`# Dimensions source,...`), the Excel details sheet, the printed report, and the comparison table, and Load Test reads it back, so a file made from example values still says so when reopened.

## Data checks

After a test, and when a file is opened in Load Test, a **Data checks** line under the graph reports two things, as warnings only: readings whose time is equal to or earlier than the one before (duplicate times, going backwards, or a reset), and a peak force below the 1 N the force-drop option needs. Unreadable lines skipped while recording are listed with them. The checks never change, drop, or reorder a reading, and a clean result does not confirm the data is valid. The same text is written to the CSV header (`# Data checks,...`), the Excel details sheet, and the printed report. Older files without that line open as before.

## Printable report

A **Print report** button appears on a test page once a test has ended, on Load Test (for the opened file), on the comparison summary, and on the Calibration page. It opens the browser's print window with a clean one-page report (use *Save as PDF* there to keep a file): a Draft marker and the source ("Measured data", "Simulated data, not measured", or "Loaded data"), the test details (material, specimen ID, date, dimensions, speed, temperature, environment, notes, how the test ended), the graph as currently shown, the key results with their definitions (labeled calculated), how the values were obtained (force and crosshead displacement are recorded; stress and strain are calculated; strain is not from an extensometer), a note that nothing was uploaded and the hardware is untested, and blank "Prepared by / Reviewed by / Date" lines. The comparison report adds the specimen table, warnings, the overlay, and the mean, standard deviation, and n. Nothing is stored. The Calibration report shows the entered masses and readings, the errors, the fit, and its chart instead, with the same Draft marker and the cautions that tare is not a calibration and that nothing is traceable. The report is built in report.js and looks the same as the rest of the site only in font (it follows your Font setting).

The **Learn** page has a **Print blank run sheet** button under "Before you test". It opens the same print window with a one-page, empty form to fill in by hand: test type, date and operator, specimen ID, material, dimensions, speed, temperature and environment, the draft pre-test checklist from `data/checklist.js`, an "after the test" block, ruled notes, and Prepared by / Reviewed by / Date lines. It is marked Draft, is not a record of any test, and nothing is stored or uploaded. The button's label is `printButton` in `data/text/learn.js`.

## Editing the page text

The words on Home, Learn, About, and Help are in plain files in `data/text/` (`home.js`, `learn.js`, `about.js`, `help.js`); the numbered reference list on Help is in `data/references.js`. Edit the text between the quotation marks and save. If a file has a mistake, only the affected section shows a box naming the file, and `check-text.html` says what to fix. See `EDITING-TEXT.md` for the steps.

## Graph tools

Every graph (protocol examples, Load Test, and the test pages once a test has ended) has these display tools. They never change the calculated results.

- **Show regions** draws textbook-style dashed boundaries with a labeled arrow for each region: steel (Elastic, Strain hardening, Necking), skin (Toe, Linear, Failure), concrete (Near-linear, Fracture), and relaxation (Ramp, Hold). Boundaries come from the same points the key results use (offset yield, peak, 50% force drop). The end of the skin toe region has no standard definition, so it is drawn where the slope reaches half its steepest value and labeled "approximate". The skin schematic under the graph is an illustration, not data.
- **Key results** can be selected to highlight their point on the graph, or ticked (Show all / Hide all) to keep them visible: the fitted slope for E, yield with its offset line, UTS, failure point, toughness area, and for relaxation σ₀, final stress, the relaxed amount, and τ. On New Test and Load Test each result shows only its name and value; the **Show definitions** switch above the list opens the definitions, and **Graph tips** holds the keyboard and zoom hints. **Copy results**, next to Show all / Hide all, copies the key results as tab-separated text that pastes into Excel or Word as a table; its first line is the data source (for example "Simulated data, not measured"), so a pasted table is never mistaken for measured data.
- **Zoom and pan:** small + / − / reset icons sit at the top right of the graph. You can also scroll over the graph, press + / −, or drag a box around an area to zoom to it. Axis values get finer as you zoom, and a line under the graph states the visible range. When zoomed, drag to move, press [ and ] (left/right) or Page Up / Page Down (up/down), and double-click or use the reset icon to return. This changes the display only; PNG and SVG downloads use the current view (without the icons). The ← → keys still move the readout.
- **Tangent line at cursor** (uniaxial) draws the line with the slope shown as "Tangent modulus" in the readout.
- **Download for Excel (.xlsx)** writes a Details sheet (test details, key results with their definitions), a Data sheet, and a native scatter chart. It is built in the browser by `excel-export.js` with no library. It was checked with openpyxl and LibreOffice only, not with Microsoft Excel. The CSV download stays.

## Checks

Beyond `node scripts/check-site.js`, there is an optional, slower `node scripts/check-combinations.js` (add `--quick` for a sample). It needs Playwright installed on your computer (`npm install playwright`); it is not run by the publish workflow. It loads every page in a real browser under every color theme × layout × style, plus a set that covers every pair of display choices, and reports bugs (FAIL) and low text contrast (WARN).

There is no build and no automated test suite in this repository. Changes are checked by previewing in Chrome's engine at desktop widths (1280 px and 1024 px; phone widths are not checked for now), in every theme, layout, and style, and by running the simulator on both test pages. See the pull request descriptions for the exact steps used. Every page has a Content Security Policy tag (see `FILES.md`). After changing a page, open it in Chrome with the console open and look for "Refused to …" messages.

## Review and publishing

Nothing is uploaded to GitHub, merged, or published without the project owner's okay. AI assistants prepare changes on a separate branch and show a preview; the owner decides whether the branch is uploaded, opens the pull request into `main`, merges, and publishes. The site is published with GitHub Pages (https, so USB still works in Chrome): merging into `main` publishes it. Expected address: <https://alevaldo05.github.io/Biomaterials-Tensile-Tester/> (to be confirmed on the first deploy). How to set it up and how to tell when a deploy has finished: [docs/DEPLOY.md](docs/DEPLOY.md). Backups and branch organization: [docs/BRANCHES.md](docs/BRANCHES.md).

## Tutorials

Short animated illustrations of the screen (run a simulated test, enter specimen dimensions, connect over USB, read and zoom the graph, download the data, load and compare files, enter a calibration) play **on the page where you do the thing**: press **Watch how** at the spot (at the top of each test page, at the Dimensions and Connection steps, under the graph, on Load Test, on Calibration). Each opens a wide panel with Pause, Replay, and Hide, and says it is an illustration, not a recording of a real test. With Motion set to Reduced (or the system asking for less motion) they are shown as still frames with Back and Next. The Help page has a Tutorials list of links to each spot, and **Need help?** and a step's "?" jump to them. They are hidden while a test is recording. They are drawn from `data/tutorials.js` with SVG and CSS; no video or outside files.

## Definitions on hover

Terms with a dotted underline (Key results, Readout, setup labels, table headings on Compare, Materials, and Calibration) show a small box with the definition when you point at them or press Tab to them; Esc closes it. The words come from `data/terms.js`; Key results use the same text as the "Show definitions" switch, which stays (off by default).

## Project summary and cards

[PROJECT-SUMMARY.md](PROJECT-SUMMARY.md) is a short overview. Each page and feature has a one-page card in `docs/cards/` (purpose, files, behavior to keep, labels that must stay, how to check). Open the summary and the card for what you are changing; update the card in the same change.

[AGENTS.md](AGENTS.md) holds the workflow for AI assistants (Claude, ChatGPT, Gemini); `CLAUDE.md` loads it in Claude Code.
