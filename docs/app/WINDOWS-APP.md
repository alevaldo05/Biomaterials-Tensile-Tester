# The Windows app

The tester app's screens in their own window, installed on the lab computer. Source: `apps/desktop/`.
The website stays on GitHub Pages; the app is not published there.

## What it is
- One window showing the screens built from `apps/tester` (copied into `apps/desktop/ui/` and bundled in the installer). It never loads screens from a server or another site.
- USB serial (Web Serial). Each time you press Connect, a box lists the USB serial ports and you choose one; the device then identifies itself.
- Recordings are kept as files in the app's data folder (`recordings`: one `.meta.json` and one `.lines.ndjson` per recording), written by `journal-files.cjs`: each batch is flushed to disk before it counts as saved, the details file is replaced through a temporary file, and a line cut off by a crash is skipped on reading. Methods stay in the app's own storage.
- The lab server is optional. Its address is typed in Settings (for example `http://lab-pc:8080`) and saved by the Windows app on this computer (`desktop-settings.json` in the app's data folder). The screens call `/api/v1/...` on their own address; the Windows app sends only those requests on to the lab server (`lab-proxy.cjs`). The lab server is a data connection only: the screens always come from the installation. The sign-in is held by the Windows app and never given to the screens; changing the address signs out. With no address, the status bar says "Lab server: Not set up".
- It sends no Start, STOP, Tare, speed, or position command to the tester. The on-screen controls are not an emergency stop.

## Security settings (checked by `apps/desktop/test/desktop.test.ts`)
- Context isolation, the sandbox, no Node in the screens, web security on, no webviews, developer tools off in the installed app.
- The preload gives the screens a fixed label (`window.tensileDesktop.kind`), two calls to read and to set the lab server address, and the seven recording-journal calls (begin, append, finish, list, lines, remove, estimate). The journal calls check the recording id (no paths), one arrival time per line, single-line device text of at most 4096 characters, and the setup's field types; nothing is written outside the recordings folder. The main process checks the address (http or https only, no user name or password, no ? or #) and answers only the app's own screens.
- Requests sent on to the lab server: only `/api/v1/...`, with only the content type, accept, and app headers; a cookie sent by the screens is dropped, and the lab server's Set-Cookie is never passed back. Checked against the real API in `apps/desktop/test/lab-proxy.test.ts`.
- Navigation away from the app is blocked. Links to the public website open in the computer's browser; every other new window is refused.
- Permissions: USB serial (port chosen by the person) and copying text only.
- One copy at a time (two would compete for the port).
- Packaging switches (Electron fuses): no "run as Node", no `NODE_OPTIONS`, no inspector flags, the app loads only from its checked archive.

## Building an installer
The installer is built on GitHub, on Windows, by `.github/workflows/desktop.yml`. It runs only when started:
1. GitHub > Actions > **Windows app** > Run workflow (or push a tag such as `app-v0.2.0`).
2. It runs the checks, builds the screens and the installer, and creates a **draft** release with
   `Biomaterials-Tensile-Tester-<version>-beta-unsigned-setup.exe` and `SHA256SUMS.txt`.
3. A draft is visible only to people who can change the repository. Download it, try it on the lab computer, and
   publish it (GitHub > Releases > Edit > Publish) only when you are satisfied.
4. After publishing, the website's Get the App page can link to it (a separate change; until then it says
   "Download not yet available").

The installer is **unsigned**: Windows SmartScreen warns before running it ("More info" > "Run anyway").
Code signing is not planned (a possible idea for later only), so Windows will keep warning.

### Start-up check in the build
After the installer is built, the workflow runs `apps/desktop/smoke.cjs` on the unpacked program: it starts it, waits for
the window, and confirms the only open page is the app's own bundled screen (`app://tester/`), then closes it. It uses the
browser engine's local debugging port (127.0.0.1, opened only by this check; `smoke.cjs` is not part of the installer).
Its logic is tested with a stand-in program (`apps/desktop/test/smoke.test.ts`); **it has not yet been seen to run on
Windows**, so for the first runs a failure is shown in the run but does not stop the draft release
(`continue-on-error` in `desktop.yml`). Once it has passed on GitHub, remove that line so a broken package stops the build.
It does not replace the first-install checklist below.

## Building by hand (on a Windows computer)
```
npm ci
npm run app:build
cd apps/desktop
npm ci
npm run prepare-ui
npm start            (runs it without installing)
npm run dist:win     (makes the installer in apps/desktop/release/)
```

## First install checklist
Fill this in on the Windows computer after downloading the installer from the draft release. Write Pass, Fail, or the
note for each row. Anything not tried stays blank; nothing here is assumed to work.

| # | Check | Result / notes |
|---|---|---|
| 1 | The downloaded installer's hash matches `SHA256SUMS.txt` (`certutil -hashfile <file> SHA256`) | |
| 2 | SmartScreen warns; "More info" then "Run anyway" starts the installer | |
| 3 | Installs and starts; the window opens on the app's own Home screen | |
| 4 | Settings saves a lab server address and the status bar shows it; with the box empty it says "Lab server: Not set up" | |
| 5 | Connect lists the USB serial ports and lets you choose one; nothing is sent to a tester | |
| 6 | A recording makes one `.meta.json` and one `.lines.ndjson` file in the app's data folder (`recordings`) | |
| 7 | A second copy of the app does not start while one is running | |
| 8 | Help opens and is searchable with the network off | |
| 9 | Uninstalling removes the program; note whether the data folder stays | |

## Status
Built once by GitHub (`.github/workflows/desktop.yml`, run 1, succeeded; draft release `app-v0.2.0-beta.1`). It has not
been installed or run on a Windows computer, and the USB connection is untested with real hardware.
