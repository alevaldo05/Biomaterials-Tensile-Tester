# Project summary

Biomaterials Tensile Tester: a website (plain HTML, CSS, and JavaScript; no framework, no dependencies, no build step) that is the learning front end for a lab tensile tester. It has learning pages, protocols, materials, calibration, a practice page with a labeled simulator, and Load Test for reopening saved CSV files. It has no live test pages and no USB connection: real tests are run in the separate tester app, which the New Test page links to. The tester hardware connection is untested. Test data is never saved or uploaded by the site.

A separate tester app (React and TypeScript, with shared packages, a back end, and containers) is being built in `packages/`, `apps/`, `firmware/`, and `deploy/`; neither its source nor a built copy is published on GitHub Pages; it is installed on the lab computer. See the [tester-app](docs/cards/features/tester-app.md) card and `docs/app/ARCHITECTURE.md`.

Read this file, then only the cards for the page or feature being changed. Update the card in the same change.

## Pages (one card each)

| Page | Card |
|---|---|
| Home | [index](docs/cards/pages/index.md) |
| Learn | [learn](docs/cards/pages/learn.md) |
| About | [about](docs/cards/pages/about.md) |
| Help | [help](docs/cards/pages/help.md) |
| New Test (sends people to the tester app, the practice page, and Load Test) | [choose-test](docs/cards/pages/choose-test.md) |
| Practice test (simulator) | [practice](docs/cards/pages/practice.md) |
| Load Test | [load-test](docs/cards/pages/load-test.md) |
| Calibration | [calibration](docs/cards/pages/calibration.md) |
| Materials | [materials](docs/cards/pages/materials.md) |
| Uniaxial Tension protocol | [protocol-uniaxial-tension](docs/cards/pages/protocol-uniaxial-tension.md) |
| Stress Relaxation protocol | [protocol-stress-relaxation](docs/cards/pages/protocol-stress-relaxation.md) |
| Settings | [settings](docs/cards/pages/settings.md) |
| Text checker | [check-text](docs/cards/pages/check-text.md) |
| Page not found | [404](docs/cards/pages/404.md) |

## Features (one card each, in `docs/cards/features/`)

[graph-engine](docs/cards/features/graph-engine.md), [live-test](docs/cards/features/live-test.md) (the practice page's screen), [workspace](docs/cards/features/workspace.md) (the graph-first layout), [guided-steps](docs/cards/features/guided-steps.md), [help-coach](docs/cards/features/help-coach.md), [tutorials](docs/cards/features/tutorials.md), [simulator](docs/cards/features/simulator.md) (practice page only), [usb-link](docs/cards/features/usb-link.md) (retired on the website), [downloads](docs/cards/features/downloads.md) (CSV and Excel), [print-report](docs/cards/features/print-report.md), [compare](docs/cards/features/compare.md), [calibration](docs/cards/features/calibration.md), [materials](docs/cards/features/materials.md), [protocols](docs/cards/features/protocols.md), [display-settings](docs/cards/features/display-settings.md) (and themes), [layouts](docs/cards/features/layouts.md), [styles](docs/cards/features/styles.md), [site-search](docs/cards/features/site-search.md), [shared-popups](docs/cards/features/shared-popups.md), [leave-popup](docs/cards/features/leave-popup.md), [hover-definitions](docs/cards/features/hover-definitions.md), [page-text](docs/cards/features/page-text.md), [deploy-checks](docs/cards/features/deploy-checks.md), [site-footer](docs/cards/features/site-footer.md) (the "Version 2.0" line), [tester-app](docs/cards/features/tester-app.md) (the app, shared packages, back end, containers).

## Fixed rules (short form; full rules in `AGENTS.md`)

- Show a short plan and wait for approval before editing. Nothing leaves the working copy (push, pull request, merge, publish, delete, rewrite history) without the owner's okay for that action. Desktop only; Windows and Chrome matter most.
- Never remove or hide: "Not an emergency stop" beside STOP and on the pinned STOP bar; the safety line on the practice page; "Simulated data, not measured"; "Sample data, not measured"; "Typical, unreviewed"; the Draft badges; "hardware connection is untested"; "tare is not a calibration"; the dimension source and data check lines.
- Never change: calculated results, CSV and Excel contents, the printed report, the line format in `data/device.js` (the simulator's, not the app's), Esc sending STOP on the practice page, Start staying unavailable until the simulator is used, the saved setting keys.
- STOP stays visible and reachable in every state while connected (to the simulator). No website page may open a serial port or send anything to a real tester.
- Pages have a Content Security Policy: no inline `<script>` and no `onclick=`; no web fonts or outside files. Scripts are plain and load in the order in `FILES.md`.
- New pieces use the existing color variables so they work in every theme, layout, and style.

## Run and check

```
python3 -m http.server 8000     # then open http://localhost:8000/
node scripts/check-site.js      # must pass before any pull request
node scripts/check-combinations.js --quick   # optional, by hand: many display combinations in a real browser (needs Playwright)
npm install && npm test         # tester app and shared packages only; the website does not need it
```

Preview in Chrome at 1280 px and 1024 px, run both kinds of practice test on the practice page (the simulator exists only there; the website has no other test screen), and look for "Refused to" in the console. Safari and Windows are targets but usually cannot be tried by an assistant.

## To change X, open card Y

| To change | Open |
|---|---|
| Words on Home, Learn, About, Help | [page-text](docs/cards/features/page-text.md), then the page card |
| Graph, key results, CSV reading | [graph-engine](docs/cards/features/graph-engine.md) |
| Practice page setup, Start/STOP/Tare, recording | [live-test](docs/cards/features/live-test.md), [guided-steps](docs/cards/features/guided-steps.md) |
| Where New Test sends people (tester app, practice, Load Test) | [choose-test](docs/cards/pages/choose-test.md) |
| The simulator's line format | [simulator](docs/cards/features/simulator.md) (`data/device.js`; the app's protocol is in `docs/app/PROTOCOL.md`) |
| Material values or sample curves | [materials](docs/cards/features/materials.md) |
| Protocol text | [protocols](docs/cards/features/protocols.md) |
| Colors, fonts, layouts, styles | [display-settings](docs/cards/features/display-settings.md), [layouts](docs/cards/features/layouts.md), [styles](docs/cards/features/styles.md) |
| Need help? button and hints | [help-coach](docs/cards/features/help-coach.md) (`data/help-tips.js`) |
| Tutorials (animated illustrations) | [tutorials](docs/cards/features/tutorials.md) (`data/tutorials.js`) |
| Tips, pop-ups, notes | [shared-popups](docs/cards/features/shared-popups.md) |
| Definitions shown on hover | [hover-definitions](docs/cards/features/hover-definitions.md) (`data/terms.js`) |
| What search finds | [site-search](docs/cards/features/site-search.md) |
| Publishing and checks | [deploy-checks](docs/cards/features/deploy-checks.md) |
| Tester app, shared packages, back end, containers | [tester-app](docs/cards/features/tester-app.md) |

Longer guides: `README.md`, `FILES.md`, `EDITING-TEXT.md`, `docs/`.
