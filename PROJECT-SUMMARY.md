# Project summary

Biomaterials Tensile Tester: a website (plain HTML, CSS, and JavaScript; no framework, no dependencies, no build step) that runs and records tensile tests on a lab tester over USB (Web Serial, Chrome only), plots them live, and offers learning pages, protocols, materials, and calibration. Hardware connection is a draft and untested. Test data is never saved or uploaded by the site.

Read this file, then only the cards for the page or feature being changed. Update the card in the same change.

## Pages (one card each)

| Page | Card |
|---|---|
| Home | [index](docs/cards/pages/index.md) |
| Learn | [learn](docs/cards/pages/learn.md) |
| About | [about](docs/cards/pages/about.md) |
| Help | [help](docs/cards/pages/help.md) |
| Choose a test | [choose-test](docs/cards/pages/choose-test.md) |
| Practice test (simulator) | [practice](docs/cards/pages/practice.md) |
| Uniaxial Tension test | [test-uniaxial-tension](docs/cards/pages/test-uniaxial-tension.md) |
| Stress Relaxation test | [test-stress-relaxation](docs/cards/pages/test-stress-relaxation.md) |
| Load Test | [load-test](docs/cards/pages/load-test.md) |
| Calibration | [calibration](docs/cards/pages/calibration.md) |
| Materials | [materials](docs/cards/pages/materials.md) |
| Uniaxial Tension protocol | [protocol-uniaxial-tension](docs/cards/pages/protocol-uniaxial-tension.md) |
| Stress Relaxation protocol | [protocol-stress-relaxation](docs/cards/pages/protocol-stress-relaxation.md) |
| Settings | [settings](docs/cards/pages/settings.md) |
| Text checker | [check-text](docs/cards/pages/check-text.md) |
| Page not found | [404](docs/cards/pages/404.md) |

## Features (one card each, in `docs/cards/features/`)

[graph-engine](docs/cards/features/graph-engine.md), [live-test](docs/cards/features/live-test.md), [workspace](docs/cards/features/workspace.md) (the graph-first layout), [guided-steps](docs/cards/features/guided-steps.md), [help-coach](docs/cards/features/help-coach.md), [tutorials](docs/cards/features/tutorials.md), [simulator](docs/cards/features/simulator.md) (practice page only), [usb-link](docs/cards/features/usb-link.md), [downloads](docs/cards/features/downloads.md) (CSV and Excel), [print-report](docs/cards/features/print-report.md), [compare](docs/cards/features/compare.md), [calibration](docs/cards/features/calibration.md), [materials](docs/cards/features/materials.md), [protocols](docs/cards/features/protocols.md), [display-settings](docs/cards/features/display-settings.md) (and themes), [layouts](docs/cards/features/layouts.md), [styles](docs/cards/features/styles.md), [site-search](docs/cards/features/site-search.md), [shared-popups](docs/cards/features/shared-popups.md), [leave-popup](docs/cards/features/leave-popup.md), [hover-definitions](docs/cards/features/hover-definitions.md), [page-text](docs/cards/features/page-text.md), [deploy-checks](docs/cards/features/deploy-checks.md).

## Fixed rules (short form; full rules in `AGENTS.md`)

- Show a short plan and wait for approval before editing. Nothing leaves the working copy (push, pull request, merge, publish, delete, rewrite history) without the owner's okay for that action. Desktop only; Windows and Chrome matter most.
- Never remove or hide: "Not an emergency stop" beside STOP and on the pinned STOP bar; the safety line on test pages; "Simulated data, not measured"; "Sample data, not measured"; "Typical, unreviewed"; the Draft badges; "hardware connection is untested"; "tare is not a calibration"; the dimension source and data check lines.
- Never change: calculated results, CSV and Excel contents, the printed report, the message format in `data/device.js`, Esc sending STOP on test pages, Start staying unavailable until connected, the saved setting keys.
- STOP stays visible and reachable in every state while connected.
- Pages have a Content Security Policy: no inline `<script>` and no `onclick=`; no web fonts or outside files. Scripts are plain and load in the order in `FILES.md`.
- New pieces use the existing color variables so they work in every theme, layout, and style.

## Run and check

```
python3 -m http.server 8000     # then open http://localhost:8000/
node scripts/check-site.js      # must pass before any pull request
node scripts/check-combinations.js --quick   # optional, by hand: many display combinations in a real browser (needs Playwright)
```

Preview in Chrome at 1280 px and 1024 px, run both kinds of practice test on the practice page (the simulator exists only there), and look for "Refused to" in the console. Safari and Windows are targets but usually cannot be tried by an assistant.

## To change X, open card Y

| To change | Open |
|---|---|
| Words on Home, Learn, About, Help | [page-text](docs/cards/features/page-text.md), then the page card |
| Graph, key results, CSV reading | [graph-engine](docs/cards/features/graph-engine.md) |
| Test setup, Start/STOP/Tare, recording | [live-test](docs/cards/features/live-test.md), [guided-steps](docs/cards/features/guided-steps.md) |
| Tester messages, baud rate | [usb-link](docs/cards/features/usb-link.md) (`data/device.js`) |
| Material values or sample curves | [materials](docs/cards/features/materials.md) |
| Protocol text | [protocols](docs/cards/features/protocols.md) |
| Colors, fonts, layouts, styles | [display-settings](docs/cards/features/display-settings.md), [layouts](docs/cards/features/layouts.md), [styles](docs/cards/features/styles.md) |
| Need help? button and hints | [help-coach](docs/cards/features/help-coach.md) (`data/help-tips.js`) |
| Tutorials (animated illustrations) | [tutorials](docs/cards/features/tutorials.md) (`data/tutorials.js`) |
| Tips, pop-ups, notes | [shared-popups](docs/cards/features/shared-popups.md) |
| Definitions shown on hover | [hover-definitions](docs/cards/features/hover-definitions.md) (`data/terms.js`) |
| What search finds | [site-search](docs/cards/features/site-search.md) |
| Publishing and checks | [deploy-checks](docs/cards/features/deploy-checks.md) |

Longer guides: `README.md`, `FILES.md`, `EDITING-TEXT.md`, `docs/`.
