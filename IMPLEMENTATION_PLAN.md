# Implementation plan: Biomaterials Tensile Tester

> Note (later change): the website's own live test pages (`test-uniaxial-tension.html`, `test-stress-relaxation.html`) and its USB connection were retired. Real tests are now run in the separate tester app; this plan is kept as written and is no longer current for those pages.

Planning only: this file describes the work in stages. No code was changed to write it.

## Context

The site is live and works: plain HTML, CSS, and JavaScript with no framework, no dependencies, and no build step. The owner wants to move it from an early draft toward a calmer, better organized site:

1. **Organize the project** so a change needs one small file, not the whole repository (top priority).
2. **Make the pages less cramped**: definitions on hover, less instruction text, one step at a time on the test pages.
3. **Help that appears when needed** and can be closed: a "Need help?" button, hints when someone is stuck, short animated tutorials.
4. **A leave warning that looks like the site**, not the browser's own box.
5. **More color themes** (the MU colors theme was later removed by the owner; the site offers six themes): dark pink, dark purple, and Manhattan University (MU) colors, previewed before anything changes.

Everything that works today must keep working.

## Owner decisions already made

| Question | Answer |
|---|---|
| How far does the "module build" go? | Markdown cards first. Splitting the big code files is a later stage (Stage 9). |
| Guided steps on the test pages | Guided (one step at a time) by default, with a "Show all steps" switch that brings back today's full view. |
| MU colors | Preview both options (current green recolored to MU green, and a separate MU theme) next to today's green, then decide. |

## What exists now (so the investigation is not repeated)

- **15 pages** in the root (`index`, `learn`, `about`, `help`, `choose-test`, `test-uniaxial-tension`, `test-stress-relaxation`, `load-test`, `calibration`, `materials`, `protocol-uniaxial-tension`, `protocol-stress-relaxation`, `settings`, `check-text`, `404`). Each page repeats its own header and navigation.
- **Big files:** `graph.js` (95 KB, `window.TensileGraph`), `styles.css` (60 KB), `live.js` (40 KB), `materials.js` (36 KB), `compare.js` (27 KB), `calibration.js` (23 KB).
- **Test pages** are built by one template string in `live.js` (lines 26 to 83). It already has five numbered steps: 1 Specimen, 2 Dimensions, 3 Test settings, 4 Connection, 5 Review before starting. The code finds every control by its `id` (`s-mat`, `s-L0`, `c-usb`, `r-start`, `r-stop`, and so on).
- **Definitions today:** Key results definitions are `.def` elements written by `graph.js` (about line 1056) and hidden until the "Show definitions" switch (`#show-defs`, `graph.js:913` and `:1293`; CSS `styles.css:389-391`). The Glossary is a list in `data/text/learn.js`. Each test page has a "Governing equations" table in its HTML.
- **Leave warning today:** the browser's own box, from `beforeunload` in `live.js:689` (test running, or data not downloaded) and `calibration.js:295` (typed values).
- **Pop-up pattern to reuse:** the pre-test checklist in `live.js:495-537` uses a native `<dialog>` with class `pretest` (styles at `styles.css:778-787`). It stops Esc from reaching the page so Esc does not send STOP (`live.js:510`).
- **Themes:** variable blocks at the top of `styles.css` (lines 2 to 66): `light` (default green), `purple`, `pink`, `dark`. The list of allowed values is in `display-settings.js:6`; the radio buttons and color chips are in `settings.html:39-45`. The five styles in `styles-looks.css` recolor only when the theme is `light`.
- **Settings** are stored in `localStorage` through the `SETTINGS` table in `display-settings.js` and applied as `data-*` attributes on `<html>`. Motion has a setting (`data-motion`, `styles.css:922-927`).
- **Rules the code must follow:** every page has a Content Security Policy, so no inline `<script>` and no `onclick=`; no web fonts, no outside files. Scripts are plain (not ES modules) and load in a fixed order listed at the end of `FILES.md`.
- **Checks:** `node scripts/check-site.js` (10 groups: links, script syntax, data files, duplicates, build output, private details, workflow pins, security policy, page basics, skip link). It passes now. It runs on every pull request and before every publish. There is no other test suite. `*.md` and `docs/` are not published (`scripts/build-site.sh`).
- **Docs today:** `README.md` (21 KB), `FILES.md` (14 KB), `AGENTS.md` (9 KB), `EDITING-TEXT.md`, `docs/`.

## Rules for every stage

These come from `AGENTS.md` and apply to each stage below.

- Show a short plan and wait for the owner's approval before editing. One branch per stage with a short plain name (suggested names are given). Nothing is pushed, merged, or published without the owner's okay for that action. No assistant or tool names in branches, commits, or pull requests.
- No new dependencies. New shared files are plain scripts and stylesheets loaded with `<script src>` and `<link>`.
- **Text that must never be removed or hidden**, whatever is decluttered: "Not an emergency stop" beside STOP and on the pinned STOP bar; the safety line on test pages; "Simulated data, not measured"; "Sample data, not measured"; "Typical, unreviewed"; the Draft badges; "hardware connection is untested"; "tare is not a calibration"; the dimension source and data check lines.
- **Behavior that must not change:** calculated results, CSV and Excel contents, the printed report, the message format in `data/device.js`, Esc sending STOP on test pages, Start staying unavailable until connected, and the saved setting keys.
- STOP must be visible and reachable in every state while connected.
- Every new piece uses the existing color variables (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--focus`, `--danger`) so it works in every theme, layout, and style.
- Every stage ends by updating the matching card (after Stage 1), `README.md`, `FILES.md`, `AGENTS.md`, `data/search-index.js`, and the Help keyboard table when a key or feature changes.

**Checks for every stage**

1. `node scripts/check-site.js` passes.
2. Preview with `python3 -m http.server 8000` in Chrome's engine at 1280 px and 1024 px. The title wraps without clipping and nothing scrolls sideways.
3. The changed pages are opened in every color theme, and spot-checked in each layout and each style.
4. The simulator is run on both test pages from Connect to download; the console shows no "Refused to" messages.
5. The report says which browsers were really tried. Safari and a real Windows computer usually cannot be tried by an assistant; say so.

## Stage order and dependencies

```
1 Cards and summary ──► every later stage (each stage updates its cards)
2 Shared pop-up pieces ──► 3 Hover definitions ──► 5 Guided test page and declutter
                       ├─► 4 Leave pop-up
                       └─► 6 Need help ──► 7 Tutorials
8 Themes (8a preview, 8b apply): independent; can run any time after Stage 1
9 Split the big code files: last, after the features above settle
```

Stage 3 must come before Stage 5: text can only be taken off the page once the hover definitions hold it.

---

## Stage 1. Project summary and one card per page and feature

Branch: `project-cards`. Documents only.

**Build**

- `PROJECT-SUMMARY.md` in the root, about 60 lines: what the site is, the page list with a link to each card, the fixed rules (the "Rules for every stage" list above in short form), how to run and check it, and "to change X, open card Y".
- `docs/cards/pages/` with one card per web page (15 cards; the two test pages and the two protocol pages each get their own card and point to one shared feature card for what they have in common).
- `docs/cards/features/` with one card per feature: graph engine, live test, simulator, USB link, CSV and Excel downloads, print report, compare, calibration, materials data and chart, protocols, display settings and themes, layouts, styles, site search, page text files, deploy and checks.
- One fixed card shape, at most about 40 lines: Purpose; Files (HTML, scripts in load order, data, CSS section); What the user sees; Behavior to keep; Labels that must stay; Depends on; How to check.
- `AGENTS.md`: replace "Read `README.md` and inspect `index.html`" with "Read `PROJECT-SUMMARY.md`, then only the cards for the page or feature being changed", and add "update the card in the same change".
- `scripts/check-site.js`: add one check that every `.html` page has a page card and that every file named in a card exists.

**Conflict:** "as short as possible" against "keep all of the information". Resolution: the summary is short; the detail lives in the cards. Nothing is deleted from `README.md`, `FILES.md`, or `AGENTS.md` in this stage. Trimming them is proposed to the owner only after the cards are proven complete.

**Done when:** in a new chat the owner pastes `PROJECT-SUMMARY.md` and one card, and a change to that page can be planned without any other file. The site itself is unchanged.

**Verify:** the new check passes; pick three cards and confirm every file, id, and label they name exists in the code; `git diff` shows no change to any `.html`, `.js` (other than `check-site.js`), or `.css` file.

## Stage 2. Shared pop-up pieces

Branch: `shared-popups`. Foundation for Stages 3 to 7; nothing visible changes yet.

**Build**

- `ui.css` and `ui.js` (exposes `window.SiteUI`), added to every page with the header menu. `ui.js` loads before the page script; add it to the script order in `FILES.md`.
- Three pieces:
  1. **Tip:** a small box that floats above or below its word, opens on hover and on keyboard focus, closes on mouse-out, blur, or Esc, never runs off the window, and never moves other content.
  2. **Site pop-up:** a `<dialog>` in the site's look. Move the shared look of `dialog.pretest` (`styles.css:778-787`) to a common class and keep the checklist looking the same.
  3. **Dismissible note:** a small card with an X close button, not modal.
- On test pages Esc inside any of these must not reach the page's Esc-sends-STOP handler (same approach as `live.js:510`).
- Fades follow the Motion setting (`styles.css:922-927`).

**Done when:** the pre-test checklist looks and works as before, now built on the shared pop-up.

**Verify:** turn the checklist on in Settings, press Start, tick all, start; Esc closes it without STOP; check in all themes and the five styles.

## Stage 3. Hover definitions

Branch: `hover-definitions`. Needs Stage 2.

**Build**

- `data/terms.js`: one entry per term (name, symbol, short definition, equation, unit). Seed it from the Glossary in `data/text/learn.js` and the "Governing equations" tables in the two test pages. Wording is copied, not rewritten; no new claims and no new sources.
- Terms get a quiet dotted underline. Hover or Tab focus shows the tip: name, one-line definition, equation, unit.
- Where: Key results names and Readout labels (`graph.js`), setup field labels in `live.js` (Gauge length L₀, Area A₀, Crosshead speed, Hold displacement, Hold strain), Compare table headings (`compare.js`), property table headings (`materials.js`), Calibration terms.
- Key results definitions contain live values (for example the modulus fit interval). The tip shows the same text `graph.js` already builds for the `.def` element, so there is one source.
- Keep the "Show definitions" switch (off by default) for people who want every definition open at once. CSV, Excel, and the printed report keep their definitions unchanged.
- The Glossary on Learn stays as the full list. Later it can read from `data/terms.js` so the words exist once; if done, update `EDITING-TEXT.md` and `check-text.js`.

**Conflict:** hover does not exist for keyboard users. Resolution: the same tip opens on focus, and the full text stays one click away.

**Done when:** on a test page after a simulated run, pointing at "Modulus estimate" shows its definition and equation floating over the page; nothing shifts; moving away closes it.

**Verify:** hover and Tab on each place listed; tips near the right and bottom window edges stay on screen; text size 200% still readable; Esc closes a tip without sending STOP; key result values are identical before and after for a loaded sample CSV.

## Stage 4. Leave pop-up in the site's look

Branch: `leave-popup`. Needs Stage 2.

**Limit that affects the result:** no website can restyle the box a browser shows when the tab is closed, reloaded, or the Back button is pressed. Only clicks on links inside the site can be caught.

**Build**

- When a test is running, or data has not been downloaded (`running || (hasData && !downloaded)` in `live.js`), a click on any link in the page (header menu, logo, back link, search results from `site-search.js`, in-text links) opens the site pop-up instead of leaving: "Leave without saving?" with **Download CSV and leave**, **Leave without saving**, and **Stay** (the default, and what Esc does).
- While recording the pop-up also says the test is still recording and that leaving does not stop the machine; "Download and leave" is not offered until the test has stopped.
- Same pop-up on Calibration when values are typed (`calibration.js:295` condition), with **Download record and leave**.
- Keep both `beforeunload` handlers for closing the tab, reload, and Back. Help text states that those cases show the browser's own box.

**Done when:** after a simulated test, clicking "Home" shows the site-styled pop-up; Stay keeps the data; Download saves the CSV then leaves.

**Verify:** each button; with data downloaded no pop-up appears; closing the tab still shows the browser box; all themes; Esc equals Stay and does not send STOP.

## Stage 5. Guided test pages and less text

Branch: `guided-test`. Needs Stages 2 and 3.

**Build**

- **Guided view (default)** on both test pages: one step open at a time, in the existing order: Specimen, Dimensions, Test settings, Connection, Review and start. A step bar shows where you are; Next and Back move; a finished step collapses to a one-line summary that can be reopened. The graph, Readout, and Key results appear when recording starts. Downloads and Print report appear when the test ends.
- **"Show all steps" switch** returns today's full view. Remember it with a new key in the `SETTINGS` table of `display-settings.js` so "Reset" clears it.
- Each step has a small "?" button that opens that step's help in a tip (and, after Stage 7, its tutorial).
- Keep every existing `id`, the field messages, the Review panel, Start disabled until connected, the checklist pop-up, the pinned STOP bar, the tab-title status, and the disabled inputs while recording. Show and hide existing elements; do not rebuild them.
- **Less text:** helper paragraphs that only explain (the `small muted` lines in `live.js`, `materials.js`, `calibration.js`, `compare.js`, the protocol pages) move into tips or the "?" help. The "Governing equations" block on the test pages is replaced by the hover definitions plus a link to the protocol page, which already has the equations.
- Every line in "Text that must never be removed" stays on the page.

**Conflicts**

- The five layouts and five styles all restyle the test page. The guided view must be checked in each; the Tabs layout must not hide the active step.
- "Keep visible controls limited to actions that work": Next is unavailable until the step's required fields are valid, and says why.

**Done when:** opening Uniaxial Tension shows only step 1 and a step bar; a full simulated test can be run by pressing Next through to Start; "Show all steps" shows today's page.

**Verify:** both test pages, guided and full view, simulator from start to CSV download; field errors still appear and the Review "go to field" buttons open the right step; STOP visible throughout; CSV from the same typed values has the same header lines as before; layouts × styles spot-check at 1280 and 1024.

## Stage 6. "Need help?" button and hints when stuck

Branch: `need-help`. Needs Stage 2; best after Stage 5.

**Build**

- `help-coach.js` and `data/help-tips.js`. A small "Need help?" button sits at the bottom corner of the test pages, Load Test, and Calibration, above the pinned STOP bar, never covering STOP.
- Pressing it opens a small card: what this step is for, the next thing to do, a link to the matching row of Help → Troubleshooting, and (after Stage 7) "Watch how".
- **Hints that appear by themselves**, one at a time, each with an X:
  - A problem happened: USB permission denied, port unavailable, connected but no readings a few seconds after Start, unreadable lines skipped, a CSV that cannot be read, a field error that stays.
  - Waiting too long on one step without progress (starting value 60 seconds; set in `data/help-tips.js`).
- Wording comes from the Troubleshooting rows in `data/text/help.js`. Hints say what *could* be wrong and the next step; they never claim to diagnose the device.
- Closing a hint keeps it closed for that problem until the page is reloaded. A new Settings option "Help prompts" (On by default; key in `SETTINGS`) turns the automatic hints off; the button stays.
- Hints are announced politely to screen readers and never take keyboard focus. Esc is not used to close them on test pages (Esc is STOP).

**Conflict:** help that pops up by itself against "lighter on the eyes". Resolution: one hint at a time, small, closable, and switchable off.

**Done when:** sitting on the Connection step for a minute shows a small hint pointing at "Use simulator"; X closes it; "Need help?" reopens help on demand.

**Verify:** trigger each rule (a fake delay value may be used while testing); hint never overlaps STOP at 1024 px or at 200% text; Settings switch stops automatic hints; nothing is stored except the Settings choice.

## Stage 7. Tutorials

Branch: `tutorials`. Needs Stage 6.

**Build**

- A **Tutorials** section on the Help page (the hub; the main navigation stays as it is), listed from `data/tutorials.js` and added to `data/search-index.js`.
- Each tutorial is a short loop (about 10 seconds) drawn with SVG and CSS: a simplified picture of the screen with the pointer moving and the control to press highlighted, with two to four numbered captions beside it. No video files, no outside files.
- Controls: Play/Pause, Replay, and X to close. Opens in the site pop-up from the Help hub, from "Need help?", and from each step's "?".
- Motion setting "Reduced" (or the system's reduced motion) shows the same steps as still frames with Next and Back.
- First set: run a simulated test; enter specimen dimensions; connect over USB (marked untested); read and zoom the graph; download data; load and compare files; enter a calibration.
- Each is labeled as an illustration of the screen, not a recording of a real test.

**Done when:** from the Connection step, "Watch how" plays a short animation showing "Use simulator" then Start; X closes it and the page is as it was.

**Verify:** every tutorial in every theme; reduced motion shows still frames; Esc closes the pop-up without STOP; no console policy errors; Help page jump list and site search find the Tutorials section.

## Stage 8. Color themes

Independent of Stages 2 to 7. Two parts.

### 8a. Preview (branch `theme-preview`)

- A preview page on the branch only, `theme-preview.html`, not in the menu and **not merged**: side by side sample blocks (header, buttons, a card, a table, a warning, a small graph) for: today's green light and dark; MU-green versions of both; a separate MU theme; purple dark; pink dark.
- MU colors, read from Manhattan University's branding page and 2025 brand guidelines: Manhattan Green `#046A38` (PMS 349), secondary green `#A3D032`, gold `#F5A800`, white `#FFFFFF`. Sources: <https://manhattan.edu/branding-guidelines> and <https://content.manhattan.edu/marcom/branding-center/MU-BRANDING-GUIDELINES_2025.pdf>. The implementer should reopen them to confirm before use.
- Dark purple and dark pink are built the same way as today's green dark: dark background, light text, a lighter accent, and the lighter `--mark`, `--focus`, and `--danger` values.
- Gold and the secondary green are accents only (borders, highlights). They are too light for text on white.
- Colors only: no MU logo, seal, or wordmark. Name the theme "MU colors" and do not call the site official.

**Done when:** the owner has looked at the preview page (or screenshots of it) and chosen: keep today's green or switch to MU green; add the separate MU theme or not; accept or adjust the two dark themes.

### 8b. Apply the choice (branch `more-themes`)

- `styles.css`: new variable blocks (`purple-dark`, `pink-dark`, `mu`, and the green change if chosen).
- `display-settings.js:6`: add the new values. Keep the stored names `light`, `dark`, `purple`, `pink` so saved choices still work.
- `settings.html:39-45`: new radio buttons and chips, relabeled Green light, Green dark, Purple light, Purple dark, Pink light, Pink dark, MU colors.
- Check how the graph and the PNG/SVG downloads pick up colors in `graph.js`, `compare.js`, `materials.js`, and `calibration.js`, and that each new theme draws correctly.
- `styles-looks.css` recolors only with `[data-theme="light"]`; if green becomes MU green, decide with the owner whether the four styles keep their own greens.
- Update `data/search-index.js` (theme keywords), `README.md` settings table, `AGENTS.md`, and the settings card.

**Verify:** text contrast at least 4.5:1 (3:1 for large text and control borders) for every new theme, measured; every page opened in every new theme; focus rings visible; the tab icon recolors; a graph PNG downloaded in each new theme is readable; the printed report is unchanged.

## Stage 9. Split the big code files (later)

Branch per file, for example `split-styles`. Only after the stages above settle.

- Order: `styles.css` (by its existing sections), then `live.js` (setup form, links and simulator, run control, CSV), then `graph.js` (calculations, drawing, tools, downloads, CSV reading).
- Stay with plain scripts that share `window` objects. ES modules do not load when `index.html` is opened by double-click, which `README.md` supports today.
- Each step only moves code. Update the script order in `FILES.md`, each page's `<script>` list, the cards, and `scripts/check-site.js` if it names a file.

**Verify:** for a fixed sample CSV opened in Load Test, every key result and the downloaded CSV and Excel files are identical before and after; screenshots of each page match; `check-site.js` passes.

---

## Conflicts and how the plan settles them

| Conflict | Settled by |
|---|---|
| Short docs against complete docs | Short summary plus detailed cards; nothing deleted until cards are proven (Stage 1). |
| Remove instruction text against required safety and honesty labels | A fixed list of text that always stays (Rules). |
| Site-styled leave pop-up against what browsers allow | Site pop-up for links inside the site; the browser's box stays for close, reload, and Back (Stage 4). |
| Hover-only help against keyboard use | Tips open on focus too; full text one click away (Stage 3). |
| Esc closes pop-ups against Esc sends STOP | Pop-ups stop Esc from reaching the page; hints do not use Esc (Stages 2, 6). |
| One step at a time against STOP always in reach | STOP and the safety line are outside the steps and always shown (Stage 5). |
| Help that appears by itself against a calm page | One hint at a time, closable, with an off switch (Stage 6). |
| Animations against the Motion setting | Still frames when motion is reduced (Stage 7). |
| MU green against the four styles' own greens, and brand use | Preview first; colors only, no logo (Stage 8). |
| `AGENTS.md` describes today's pages exactly | Each stage updates `AGENTS.md` in the same change. |

## Decisions still open (defaults used unless the owner says otherwise)

1. Keep the "Show definitions" switch alongside hover tips. Default: keep.
2. Waiting time before a "stuck" hint. Default: 60 seconds.
3. Tutorials hub lives on the Help page, not a new menu item. Default: Help page.
4. After Stage 1, trim `README.md` and `FILES.md` to point at the cards. Default: ask after the cards are reviewed.
5. Stage 8a outcome: MU green replaces today's green, or MU is a separate theme, or both.
6. Whether the Glossary on Learn should read from `data/terms.js`. Default: later, not in Stage 3.

## Not covered by this plan

Phone layouts, Firefox and Edge, the controller code and real hardware testing, advisor review of protocol text and material values. They stay as they are.
