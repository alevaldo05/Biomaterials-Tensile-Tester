# How to use the Biomaterials Tensile Tester

A step-by-step guide for lab users and for the project owner.

**Status: draft.** The hardware connection is untested. The app has never been installed or run on a Windows computer, the firmware has never run on a board, and nothing has been connected to the tensile tester. Every "untried" note in this guide is deliberate; please keep them until someone has tried the step and written the result down.

## Contents

1. [What each part is](#1-what-each-part-is)
2. [Safety and data honesty](#2-safety-and-data-honesty)
3. [Getting the app](#3-getting-the-app)
4. [Using the app](#4-using-the-app)
5. [Using the website](#5-using-the-website)
6. [The lab server (optional)](#6-the-lab-server-optional)
7. [Firmware and the board](#7-firmware-and-the-board)
8. [Troubleshooting](#8-troubleshooting)
9. [Where to read more](#9-where-to-read-more)

## 1. What each part is

| Part | What it is for | What it never does |
|---|---|---|
| **The website** (plain pages on GitHub Pages) | Learning: background, glossary, protocols, materials. A **practice page** with a labeled simulator. **Load Test** for reopening saved CSV files. A **Calibration** page for comparing typed force readings with known masses. | It never connects to the tester. It has no USB connection. It saves nothing. |
| **The tester app** (opens in Chrome, or as the Windows app) | Records force and displacement from the acquisition board over USB serial. Shows the graph and key results. Saves the data. | It sends **no** command to the tester: no Start, STOP, Tare, speed, or position. The crosshead is moved and stopped on the tester's own controller. |
| **The Windows app** | The same app screens in their own window, installed on the lab computer. Recordings are kept as files in the app's data folder. | It is not published on GitHub Pages. Never installed on Windows yet. |
| **The lab server** (optional) | Sign-in, saved tests shared in the lab, test methods, device profiles and approved calibrations. | Recording never depends on it. If it is down, you can still record and download. |
| **The firmware** (ESP32 and ADS1115) | Reads the analog signals and sends raw counts to the computer over USB. | It only reads. It sends no command to the tester. Never run on a board. |

How they fit together:

```
tester's analog outputs -> (reviewed protection circuit, owner adds) -> ADS1115 -> ESP32 -> USB -> Chrome / Windows app
```

The tester's output pins, signal scaling, and grounding are **not verified**. Nothing in this project invents them.

## 2. Safety and data honesty

> **Read this before you use anything.**
>
> - The app has **no emergency stop** and sends **no command** to the tester. Stop the machine with the tester's own controls. The app screens say: "Move and stop the crosshead on the tester's own controller. This app only records."
> - **End recording** only stops saving readings. It does not stop the machine.
> - On the website's practice page, **STOP tester** and the Esc key go to the simulator. They are not an emergency stop either, and the page says so.
> - **Simulated data** is always labeled "Simulated data, not measured". **Sample data** is always labeled "Sample data, not measured". Never report either as a measurement.
> - The property values on the Materials page are **typical, approximate, and unreviewed**. They are not measurements and not from one named table.
> - **Zero force** in the app is a software baseline. It is not a machine tare and not a calibration.
> - The **calibration check** (Device screen) and the **Calibration page** (website) compare readings with known masses. They are checks, not calibrations. They change no reading and make no claim of traceability.
> - The website saves nothing. Test data stays in the tab until you download it.
> - Ask a technician or the laboratory before connecting anything to the tester, or if the tester behaves unexpectedly.

## 3. Getting the app

### 3.1 For lab users

1. Open the website and press **Get the app** on Home. This opens the Get the App page.
2. The page says **Download not yet available** until the owner publishes a release. Nothing can be downloaded before that. Ask the owner for the installer.
3. Real tests on the tester are run in the app on the lab computer, not on the website.

### 3.2 For the owner: making the download

The Windows app is built on GitHub, on Windows, only when you start it. Nothing is published automatically.

1. On GitHub open **Actions**, choose **Windows app**, and press **Run workflow**.
2. Wait for it to finish. It runs the checks, builds the screens, builds the installer and a portable program, and creates a **draft release**. A run started by hand names the draft `app-v<version>-run.<n>` (for example `app-v1.0.0-beta.1-run.7`).
3. The draft holds three files and is visible only to people who can change the repository:
   - `Biomaterials-Tensile-Tester-<version>-beta-unsigned-setup.exe` (the installer),
   - `Biomaterials-Tensile-Tester-<version>-beta-unsigned-portable.exe` (runs without installing),
   - `SHA256SUMS.txt` (the hash of both).
4. Download the files. On Windows check each hash and compare it with `SHA256SUMS.txt`:
   ```
   certutil -hashfile <file> SHA256
   ```
5. Windows SmartScreen will warn, because the files are **unsigned** (code signing is not planned). Choose **More info**, then **Run anyway**.
6. Install with the setup file, or run the portable `.exe` without installing.
7. Open **Help** in the app. Its last line reads like `Version 1.0.0-beta.1 · built from <commit> · shared website files <hash>`. On the repository, run:
   ```
   node scripts/shared-files.js
   ```
   The short hash it prints should match the "shared website files" part of the Help line.
8. Fill in the first-install checklist in [docs/app/WINDOWS-APP.md](app/WINDOWS-APP.md).
9. Publish the draft (**Releases**, **Edit**, **Publish**) only when you are satisfied. Linking it from the Get the App page is a separate website change.

### 3.3 Running from source on Windows (PowerShell)

Needs Node.js 20 or newer and the repository (get it with Git).

1. In the project folder:
   ```
   npm ci
   npm run app
   ```
2. Open Chrome at <http://localhost:5173>. Web Serial (USB) works in Chrome only on `localhost` or HTTPS.

To run the Windows app from source instead:

```
npm ci
npm run app:build
cd apps/desktop
npm ci
npm run prepare-ui
npm start
```

### 3.4 What has not been tried

- The installer on a real Windows computer: **never installed or run**.
- The portable `.exe`: **never built by GitHub and never run**. Where it keeps its data, and whether recordings survive closing it, are unknown.
- Version `1.0.0-beta.1` has not been built on GitHub yet.
- Safari for the website and a real Windows computer: not tried. Checks so far were in Chrome's engine on Linux.
- The USB connection with a real board: **never tried**. The hardware connection is untested.

## 4. Using the app

The app is one window. The menu across the top is **Home**, **Test**, **History** (only when signed in), **Device**, **Help**, **Settings**, and **Admin** (admins only). Below it a status bar shows six separate indicators: Device, Data, Calibration, Recording, Local storage, and Lab server. While a recording is running, only **Test** and **Help** can be opened.

At the bottom of every screen a **Need help** button opens a short note about the screen you are on, with a link to the full **Help** screen. Help works offline.

### 4.1 Home

Home has tiles: **Start a new test** (it reads **Back to the recording** while recording), **Load a recorded test**, **Test methods**, and **Device check**. It also shows:

- **Recent tests** from this computer and, if you are signed in, from the lab server.
- A **Device** card with the connection state and calibration.
- **Interrupted recording**. See [4.7](#47-an-interrupted-recording).

### 4.2 Run a test

Before you start: connect the acquisition board by USB. Do not connect the tester to the board unless the owner has reviewed the interface circuit (see [section 7](#7-firmware-and-the-board)).

1. Open **Test**. The **Quick settings** panel is on the left. On a narrow window (1100 px and narrower) press **Setup** to open it.
2. Under **Test**:
   1. Choose the **Test type**: **Uniaxial tension** or **Stress relaxation**.
   2. Type the **Material**. It is required. You can pick a name from the list or type your own.
   3. Type **Speed to set on the tester** in mm/min. It is required. This is an instruction for the operator and is written into the record. The app does not set the machine speed.
   4. For stress relaxation, type **Hold displacement (instruction)** in mm and **Hold duration (instruction)** in s. These are also instructions only.
   5. For uniaxial tension you may tick **Include offset yield (optional)**; then type the **Offset** (% strain, 0.05 to 5).
   6. **Fill example** fills example settings. They are not measurements.
3. Under **Specimen**:
   1. Optionally type a **Specimen ID**.
   2. Type the **Gauge length**, **Width**, and **Thickness** in millimetres. Measure them; leave a field empty rather than guessing. The area (width × thickness) is shown.
   3. **More details** holds Temperature, Environment, and Notes. Notes can still be changed after the test.
4. Under **Connection**:
   1. Press **Connect…**. The browser (or the Windows app) lists the USB serial ports. Choose the board's port. The app never opens a port by itself.
   2. The app asks the board who it is. Only after the board answers is it shown as identified. **Device details** lists the device, channels, and rate.
   3. If a message appears, see [section 8](#8-troubleshooting).
5. Under **Setup file and calibration**:
   1. Load the **Setup file** for this tester (a device profile and calibration records), or, if signed in, choose **Setup from the lab server**.
   2. A calibration is used only when the whole signal path matches the one it was made with. Without one, readings stay in volts and no force, stress, or strain is calculated.
   3. **Record voltages only (no force, stress, or strain)** records volts on purpose.
6. Under **Before you start**, read the checklist. **Start recording** stays unavailable, with the reason written under it, until everything needed is ready. "Ready to record" says nothing about whether the machine is ready to move.
7. Optional: press **Zero force** to take a software baseline. It is subtracted in the results and saved with the test. It is not a tare and not a calibration, and it sends nothing to the tester. It is available only while connected, before recording, and when a force reading is arriving.
8. Press **Start recording** under the graph.
9. **Start the test on the tester's own controller.** The app only records. The quick settings fold to a slim rail and are locked while recording. The **Live** card shows Force, Displacement, Stress, Strain, Elapsed, Rate, and Saved. A missing value is a dash, never an invented number.
10. Move and stop the crosshead with the tester's own controls.
11. When the test is over, press **End recording**. This stops saving readings only.

While recording, samples are kept in memory and on this computer about once a second. If "Stale data" appears (no readings for 2 seconds), check the USB cable and the board.

### 4.3 After the test

1. The graph and **Key results** appear. Each result shows a name, a value, and a unit. Press the **i** button beside a result to read its definition and caveats. Strain is crosshead-based unless stated otherwise. Modulus and similar results are estimates.
2. **Session details** lists how the test ran, including how it ended.
3. Open the **Save data** menu:
   - **Test data (CSV, opens in Excel)**
   - **Test data with chart (Excel .xlsx)**
   - **Graph picture (PNG)** and **Graph picture (SVG)**
   - **Every raw sample (CSV)**
   - **Session file (full record)**
   - **Print report (save as PDF from the print window)**. The report is marked Draft and is not saved by the app. The print window after a test has never been tried.
   - **Save to the lab server**, only when you are signed in.
4. The **Specimens** list at the bottom shows the tests finished since the app was opened. Older tests are in Load test.
5. Press **New test** for the next specimen. If the data has not been downloaded or saved on this computer, the app asks: **Download and continue**, **Don't save and continue**, or **Cancel**.

The Excel (.xlsx) file has been checked with openpyxl and LibreOffice, not with Microsoft Excel.

### 4.4 Load test and Compare tests

1. Open **Load test** (from Home, or via the menu tile).
2. Press **Open a file** and choose a session file saved by the app, or a CSV file. For a CSV you may set **Test type (CSV files)**; the default is **Read it from the file**.
3. Files marked as simulated are not opened here. Practice files open on the website's Load Test page.
4. The file's graph, **Key results**, and **From the file** facts appear. Imported files are labeled as unverified. Nothing is uploaded.
5. **Save data** exports the opened test, or the original file. **Print report** prints a Draft report.
6. To compare specimens, switch from **One test** to **Compare tests**. Press **Add files**, or add recent tests, up to 12 tests of one test type. You get an overlay graph, key results per test with the mean and sample standard deviation, and warnings (for example different materials or no specimen ID). **Save summary** downloads a summary CSV. **Clear all** starts again.

### 4.5 Test methods

A method is a saved setup. Changing one makes a new revision; tests keep the revision they used.

1. Fill in the Test screen, then open **Test methods** and give the setup a name. Press **Save method**.
2. Press **Start a test** beside a method to start from it.
3. **Change…** makes a new revision. **Archive** retires a method.
4. Methods are kept on this computer. When signed in, they are shared through the lab server (admins save, change, and archive).

### 4.6 Device and Calibration check

Open **Device** (the Device and calibration screen).

1. **Acquisition device**: shows the connection state and has **Connect…** and **Disconnect**.
2. **Calibration in use** shows whether Force and Displacement are calibrated or uncalibrated, with the reasons.
3. **Calibration check** is a check, **not a calibration**. It compares the force the app shows with the force expected from known weights (F = m g). It changes no reading and no calibration, saves nothing, and makes no claim of traceability.
   1. Press **Start calibration check**.
   2. Type each mass and the force shown, or press **Read force** to average the calibrated force over 1 second. **Add row** and **Clear rows** manage the rows. Read force has never been tried with a real board.
   3. Read the per-point errors, the fitted line, and the tolerance flags (flags use only a tolerance you enter).
   4. **Download check (CSV)**, **Copy results**, or **Print check**.
4. **Diagnostic summary**: press **Copy summary** and send it with your question when asking for help. Nothing is sent anywhere; check the text before sharing it.

### 4.7 An interrupted recording

If the app closed, the computer lost power, or the connection was lost during a recording, Home shows **Interrupted recording**. It says how many samples were saved and up to when. Anything after the last saved batch was not saved and cannot be recreated.

1. **Open it** shows what was saved in Load test.
2. **Download its session file** saves it.
3. **Mark as handled** removes the notice.

A test ended by a fault, a board restart, or a lost connection is shown as interrupted, with the reason.

### 4.8 History and Admin (lab server)

When the lab server is set up:

1. Press **Sign in to the lab server** at the top right. A new account must choose its own password first (at least 10 characters).
2. **History** (**Saved tests**) lists your saved tests; an admin sees everyone's. **Download session file** or **Open in replay**.
3. **Admin** (admins only) manages people, device profiles, and calibrations, and shows the record of changes. Approve a calibration only after it has been checked. **View as user** changes only what the screen shows.
4. **Password** and **Sign out** are at the top right.

### 4.9 Help

**Help** has every help topic, searchable, offline. It links to the website's Troubleshooting. Its last line is the version line (see [3.2](#32-for-the-owner-making-the-download)).

### 4.10 Settings

1. **Display**, **Theme**: **Light**, **Dark**, or **Follow system** (the default). Remembered on this computer.
2. **Recordings on this computer**: lists recordings with **Download** and **Remove**. Remove one only after downloading it or saving it to the lab server.
3. **Lab server**: in the Windows app only, type the lab server address (for example `http://lab-pc:8080`) and press **Save address**. **Check connection** tests it. Changing the address signs you out. Leave it empty to work without a lab server; the status bar then says "Lab server: Not set up".

## 5. Using the website

Open the website in Chrome (Windows or Mac) or Safari (Mac). The menu is **Home**, **Learn**, **Protocols**, **Materials**, **Calibration**, **About**, **Help**, **Settings**, and a magnifying-glass **search** button.

| Page | What it is for |
|---|---|
| **Home** | Starting point. **Get the app** and **Learn and practice**. |
| **Get the App** | Says **Download not yet available** until a release is published. Links to the practice page and Load Test. |
| **Learn** | Before you test (checklist), Background, and the Glossary. Hover or Tab onto a dotted-underlined term for its definition. |
| **Protocols** | Uniaxial Tension and Stress Relaxation, both marked draft. Four tabs: Steps, Specimen and equipment, Report and notes, and Example graph and equations. |
| **Materials** | Typical property tables ("Typical, unreviewed"), a two-material comparison, and a chart of Young's modulus against density. Example curves not made by hand are labeled "Sample data, not measured". |
| **Calibration** | See 5.3. |
| **About** | Background, project status, further reading, references. |
| **Help** | Troubleshooting, Keyboard, tutorials, and the references list. |
| **Settings** | Display choices. See 5.4. |

### 5.1 The practice page

Reached from Get the App and from Learn. It connects only to its own labeled simulator, never to USB and never to a tester. Everything it shows is **"Simulated data, not measured"**.

1. Work through the setup one step at a time with **Back** and **Next**: Specimen, Dimensions, Test settings, Connection, Review and start. **Next** says what is missing. **Show all steps** (top right) shows every step at once.
2. **Material** is required. **Crosshead speed** is required. The Dimensions and Test settings steps each have their own **Fill example** link; nothing is prefilled.
3. In the Connection step press **Use simulator**.
4. Press **Start recording**. Readings are plotted live.
5. **STOP tester** and Esc go to the simulator. They are not an emergency stop. **End recording** only stops saving readings on the page.
6. After the test: choose a graph view (Force-displacement, Stress-strain, Force-time), read **Key results**, and **Copy results**. Download the data as CSV (opens in Excel) and the graph as PNG or SVG. **Print report** opens the browser's print window.
7. Setup entries are locked until **New test**. If the data has not been downloaded, you are asked before it is cleared.
8. **Watch how** plays a short animated illustration. These are drawings, not recordings of a real test.

### 5.2 Load Test

Opens an earlier CSV in the browser only. Nothing is uploaded or stored. **Choose file**, read the graph and key results, or use **Compare several files** (up to 12 files of one test type) for an overlay, mean and sample standard deviation, and a summary CSV. Warnings appear for mixed simulated and measured data, mixed materials, or missing dimensions. **Print report** is available.

### 5.3 The Calibration page

Compares force readings you type in (from the tester app) with known masses (F = m g). It fits a line, shows errors and a chart, and downloads a CSV record, copies the results, or prints a one-page Draft report. It changes no reading anywhere, makes no claim of traceability, saves nothing, and flags points only against a tolerance you enter. **Tare is not a calibration.**

### 5.4 Settings (website)

Display choices are remembered in this browser only and change appearance only. Downloaded files stay in base units.

- **Color theme**: six themes, **Green light**, **Green dark**, **Purple light**, **Purple dark**, **Pink light**, **Pink dark**.
- Font, layout, style, text size, spacing, and motion.
- Graph: starting line thickness, curve style, and grid.
- Units and digits: stress unit, strain unit, and displayed digits.
- **Pre-test checklist** (off by default): a reminder pop-up before Start on the practice page. It is a reminder, not a safety certification.
- **Help prompts** (on by default) turns the automatic hints off.

### 5.5 Leaving a page

If a test is recording, test data has not been downloaded, or the Calibration page has typed values, clicking a link inside the site opens "Leave without saving?". **Stay** is the default and what Esc does. Closing the tab, reloading, or pressing Back shows the browser's own box.

## 6. The lab server (optional)

The lab server holds sign-ins, saved tests, methods, device profiles, and calibrations. It is not needed to record or to download data. It runs as containers on one computer (a gateway, the website, the app, the back end, a PostgreSQL database, and a backup service). **It has not been tried on Windows with Docker Desktop**, nor on the lab computer.

Minimum steps (full text, including Windows, HTTPS, backups, and updating one part: [docs/app/CONTAINERS.md](app/CONTAINERS.md); roles, settings, and limits: [docs/app/BACKEND.md](app/BACKEND.md)):

1. Install Docker (Docker Desktop on Windows with the WSL 2 option). Get the repository with Git, not a zip.
2. In PowerShell, in the `deploy` folder:
   ```
   copy .env.example .env
   notepad .env
   ```
   Set `POSTGRES_PASSWORD` to a long random password. `.env` is never committed.
3. Start it:
   ```
   docker compose up -d --build
   ```
4. Create the first admin (it asks for the password without showing it):
   ```
   docker compose exec api node dist/cli.js create-admin <username>
   ```
5. Open <http://localhost:8080/app/> for the app and <http://localhost:8080/> for the website. Use `localhost` on the computer the tester is plugged into, because Chrome allows USB only on `localhost` or HTTPS. Opening it to the lab network needs HTTPS first.
6. In the Windows app, type the lab server address in **Settings** and sign in.
7. Copy the `deploy/backups` folder to another disk now and then.

## 7. Firmware and the board

The reference firmware reads an ADS1115 over I2C on an ESP32 and sends raw counts over USB serial (protocol version 1, 921600 baud). It only reads. **It has been compiled on GitHub and run on a computer against a pretend ADS1115, but it has never been run on a board. The ADS1115 wiring is untried. The Windows USB drivers are unchecked.**

1. Read [firmware/README.md](../firmware/README.md) (layout, build, adding another board) and [docs/app/SETUP.md](app/SETUP.md) (what is not known, electrical restrictions, where each setting lives).
2. For a first bench test with the tester **disconnected**, follow [docs/app/BREADBOARD-TEST.md](app/BREADBOARD-TEST.md) (a potentiometer as the voltage source) and fill in the bench record sheet in SETUP.md.
3. The pins, I2C address, and channel assignment in `firmware/esp32-ads1115/include/board_config.h` are **examples**. Check them against your own boards.
4. **Do not connect the tester** until its analog output pins, scaling, and grounding have been verified and the interface circuit (protection, scaling, and isolation as needed) has been designed and reviewed. The owner adds that protection circuit. Never put more than the ADS1115 supply voltage on an input.
5. A calibration made on real equipment is needed before the app shows force, stress, or strain. Without it the app shows volts.
6. Other boards: [docs/app/GUIDE-pico.md](app/GUIDE-pico.md) and [docs/app/GUIDE-raspberry-pi-service.md](app/GUIDE-raspberry-pi-service.md) are guides only; no firmware exists for them.

## 8. Troubleshooting

These rows come from the app's Help and the setup notes. They are first checks, not guaranteed fixes. For anything involving the tester, ask a technician or the laboratory.

| What you see | What it usually means / what to do |
|---|---|
| This browser cannot open USB serial ports | Use Chrome on a computer, or the Windows app. |
| Permission denied | Choose the port again and allow access. |
| Port in use | Close other programs or windows using the port (for example a serial monitor or another tab). |
| The port could not be opened | Check the cable, the power, and the USB driver for the board's USB chip. |
| No identification | Wrong port, different firmware, a different serial speed, or a missing USB driver for the board. |
| Incompatible protocol | Update the app or the firmware so the versions match. |
| ADC not responding | Check the ADC power, wiring, and address. Ask a technician or the laboratory before connecting anything to the tester. |
| A channel is missing | `TT_CHANNELS` in `board_config.h` does not include a force and a displacement channel. |
| Readings are in volts, not newtons | No matching calibration is loaded. Load the setup file for this tester, or ask whoever looks after calibration. |
| Stale data | No readings for 2 seconds: check the USB cable and the board. |
| Save error while recording | The recording continues in memory. Download the data as soon as it ends. |
| A recovery notice on Home | Open the recording to see what was saved, or download its session file, then mark it handled. |
| Load test: file marked as simulated | The app opens recorded tests only. Practice files open on the website's Load Test page. |
| Load test: no dimensions | Stress and strain need the specimen dimensions stored in the file. |
| Cannot add a test to a comparison | A comparison holds one test type and at most 12 tests. Use **Clear all** to start a new one. |
| The file is empty or too large (limit 64 MB) | The app opens files up to 64 MB. |
| Lab server: Not set up | No address has been saved in this Windows app. Ask the lab for the address. |
| Lab server: Not connected | The address is saved but the lab server does not answer from this computer. Check the address and the network. Recording still works. |
| Website: "That is not a number" beside a field | Type digits only, with a point or a comma, in the unit shown. Dimensions, speed, and hold values must be greater than 0. |
| Website: a CSV file cannot be opened | Review the test type, delimiter, column names, units, and reported row errors. |
| The modulus looks wrong | Check dimensions, strain source, preload and reference state, slip, and the fitted interval. |
| Readings stop during a real test | Machine state may be unknown. Follow the approved physical stop procedure. The on-screen buttons are not an emergency stop. |

## 9. Where to read more

- [README.md](../README.md) and [PROJECT-SUMMARY.md](../PROJECT-SUMMARY.md): the website and the project rules.
- [docs/app/FEATURE-STATUS.md](app/FEATURE-STATUS.md): what works, what is simulated, what is untested, what is unsupported.
- [docs/app/ARCHITECTURE.md](app/ARCHITECTURE.md), [docs/app/PROTOCOL.md](app/PROTOCOL.md), [docs/app/WINDOWS-APP.md](app/WINDOWS-APP.md).
- [EDITING-TEXT.md](../EDITING-TEXT.md): how to change the words on Home, Learn, About, and Help.
- [HANDOFF.md](../HANDOFF.md): for the next person picking up the project.
