# Sign-in on the lab computer

Who may run the machine is decided on the lab computer, in the Windows app. The website has no sign-in and saves nothing. The browser version of the tester app does not connect to the tester at all: it says tests are run from the Windows app on the lab computer.

Status: written and checked by automated tests and on Linux (see "What was checked"). **Not yet tried on a Windows computer.**

## Kinds of access

| Access | Signs in with | Can run the machine | Can manage people |
|---|---|---|---|
| Admin | username and password | yes | everyone: adds operators, students, and other admins; changes anyone's access; downloads the usage log; copies the list to and from the lab server; saves and restores the backup file |
| Operator | username and password | yes | only the students they added: adds them, resets their password, sets their end date, sets their limits, turns their access off and on. Any operator (or the admin) can approve any student's training with their own password |
| Student | username and the password (or code) their operator set | yes, after the training (once) and naming a responsible operator | nobody |

- Everyone signs in the same way, in the same box.
- A new person (any kind) must choose their own password at the first sign-in, so the person who gave access does not know it afterwards. Passwords are at least 10 characters for admins and operators, and at least 8 for students.
- Only the admin can change someone's kind of access, and there is always at least one admin.

## What sign-in protects

- **Running the machine:** Connect and Start recording. Without a sign-in (or before a student completes the training and names a responsible operator) both stay unavailable and say why.
- **The Device screen's setup-file and calibration makers:** admin only.
- Load test, Test methods, Help, and Settings stay open to everyone.

This is checked twice: in the screens, and again in the Windows app's main process, which opens the USB serial port and starts a recording on this computer only for someone who may run the machine.

## Students

- **End date:** every student has an end date (for example the end of term). After it, sign-in is refused until the operator extends it. In the last 7 days the app shows "Your access ends in N days".
- **Training:** a student can sign in without it. The first time they go to run a test, the Test screen's Connection step shows **Training** instead: the training items to tick, an **Operator** choice, an **Operator password** box, and **Approve**. Any active operator or the admin approves with their own password, typed on the spot. It is saved once, with the date and who approved it, and not asked again. The items (draft wording, for the owner's review) are: safety briefing given; shown where the tester's own STOP is (the on-screen STOP is not an emergency stop); practice test completed on the learning website. The People screen's Training column shows "Done <date>, approved by <name>" or "Not yet". It is a record, not a safety certification. The website's practice page has a printable practice record a student can show.
- **Responsible operator:** after the training, before each connection, a student chooses a **Responsible operator** in the Test screen's Connection step, with no other text. It starts on the person who gave them access, who needs no password. Choosing anyone else (another operator or the admin) shows an **Operator password** box for that person's own password, typed on the spot. The choice stays until the student signs out; it cannot change while connected or recording.
- **Limits (optional):** an operator may limit a student to chosen test methods (matched by name, so a new revision still counts) and a maximum crosshead speed. The app sends no command to the tester and cannot slow the machine: outside the limits, Start recording is refused and says why. The speed limit is checked again in the main process. The limits are written into the test file.

## In every test file

The session file has an `operator` block: the name, username, and kind of access of the person signed in, and for a student the responsible operator (and how they were confirmed: "gave access" or "password"), who approved their training and when (from 1.0.0-beta.3), and any limits. It is written by the main process into the recording kept on this computer, and by the screens into the downloaded file. Load test shows it as "Run by", "Responsible operator", and "Training" ("Approved by <name> on <date>"); the test data CSV, the raw-samples CSV, and the Excel file carry it too. Older files show "Not recorded". The lab server keeps it in the stored file.

Saved test files also carry a `check`: a SHA-256 of the rest of the file. Load test says "Unchanged since it was saved", "Changed since it was saved", or "Not checked" (older files). It notices edits, including accidental ones; it is not a signature, because someone who edits the file can also work out a new check.

## First start, and a forgotten password

1. The first time the Windows app opens on a computer, it asks for the admin: name, username, and password.
2. It then shows a **recovery code** once (four groups of four letters and digits). Write it down and keep it away from the computer. It is kept only as a hash.
3. If a password is forgotten: Sign in > "Forgot your password?". The screen says "Students: ask your operator. Operators: ask the admin." (they use Reset password on the People screen). Below that, under "Admin: recovery code", the admin types the recovery code and a new password. A new recovery code is shown, and the old one stops working.

## Every day

- **Sign in:** the Sign in button at the top right, or the one in the Test screen's Connection step.
- **Switch person / Sign out:** at the top right; not while connected or recording.
- **Automatic sign-out:** after 15 minutes without activity, never while connected or recording.
- **Wrong passwords:** after 5 wrong tries for one username, that username is locked for 1 minute. Each wrong try after a lock ends locks it again for longer: 3 minutes, 5 minutes, 15 minutes, then 1 hour each time. A right password starts it again from the beginning. The app says how long to wait. The same applies to an operator's password typed for a student (training, responsible operator), to changing your password, and to the recovery code. Locks are kept on the computer (`lockouts.json`), so closing and opening the app does not clear them.
- **Wrong tries since your last sign-in:** after you sign in, a line says "N wrong tries for your username since you last signed in (last: <time>)" if there were any, with an X to close it. Because a lock is per username, someone could lock a person out on purpose for up to an hour; this line, and the usage log ("Locked after wrong tries"), show when that happened.

## The People screen

Shown to the admin and to operators.

- The list (the admin sees everyone; an operator sees their own students): access, end date, status, training, limits, who added them, last sign-in, and actions (Turn off/on, Reset password, End date, Limits…). Training is done by the student at their first test, not here.
- **Add a person** (an operator: Add a student), and **Add students from a class list**: one line per student (name, username, first password, end date), pasted from a spreadsheet or opened as a CSV, with a preview before anything is added.
- **Sign-in slips:** after adding people, Print slips prints the username and first password of each, one slip each. The slips are kept only on that screen until printed or cleared, and never saved.
- **Usage:** tests run, recording time, tests as responsible operator, and last use, per person; Download usage (CSV).
- **Usage log** (admin): every sign-in, wrong password, lock, sign-out, responsible operator, test started and ended, training completed (and who approved it), backup saved or restored, and change to the list, with the time and who did it; Download usage log (CSV). No password or code is ever written to it.
- **Second lab computer** (admin): Copy to the lab server, and on the other computer Copy from the lab server. Needs a lab-server sign-in as a lab-server admin. The copy goes from the Windows app's main process straight to the lab server; passwords travel only as the hashes kept on the computer, and never reach the screens. A person is matched by username: a newer change wins, and people only on one computer are kept. The signed-in admin's own account is never replaced by a copy. The lab server keeps each copy (table `people_copies`, routes `PUT` and `GET /api/v1/lab-people`, admin only); these accounts are separate from the lab server's own users.

- **Backup** (admin): **Save backup…** writes the list to a file you choose (for example on a USB stick), with passwords only as hashes and a SHA-256 check. **Restore from backup…** asks **Merge** (add people from the backup, keep everyone here; a newer change wins) or **Replace** (the list becomes the backup's), then opens the file. A changed file, a file that is not a backup, or one with no admin is refused. The signed-in admin is always kept. No lab server is needed. The file is written and read by the Windows app's main process; the screens never see it. Keep it as safe as the computer itself.

CSV downloads guard every text cell against spreadsheet formulas.

## Where it is kept

In the Windows app's data folder on the lab computer, in a `people` folder (on Windows usually `%APPDATA%\Biomaterials Tensile Tester\people`):

- `people.json`: the list. Passwords and the recovery code only as scrypt hashes (Node's own crypto; no other package). Written whole through a temporary file and a rename; the previous version is kept as `people.json.bak`.
- `usage-log.jsonl`: the usage log, one line per event, append only.
- `lockouts.json`: wrong tries and locks per username (names and times only, never a password).

If `people.json` is damaged, nobody can sign in and the app says so; it never replaces the file with an empty list. To restore it, close the app, copy `people.json.bak` over `people.json`, and open the app again.

## Limits of this design

- It keeps casual and unauthorised use off the machine. It is **not a lock on the tester**: the tester's own controls still work, and the on-screen STOP is not an emergency stop.
- Someone with Windows administrator rights on the lab computer can delete or replace these files. Keep the lab computer's own Windows accounts protected.
- The list is per computer. A second lab computer needs its own list, a copy through the lab server, or a backup file.
- Whoever opens the app first on a new computer creates its admin. Set up the lab computer yourself before anyone else opens the app there.
- The usage log and the responsible operator are records of what was typed and chosen in the app; they do not prove who was in the room.

## What was checked

- Automated tests: `apps/desktop/test/people.test.ts` (the rules), `apps/desktop/test/journal-files.test.ts` (the operator block in recordings), `apps/desktop/test/desktop.test.ts` (the bridge and the main-process checks), `apps/tester/test/sign-in.test.tsx` and `apps/tester/test/people-extras.test.tsx` (the screens, the controller, the files, the check), and the lab server tests on PostgreSQL (`apps/api/test/api.test.ts`).
- The Windows app was built and tried on Linux as a stand-in (see `HANDOFF.md`).
- Not yet tried on a Windows computer, with a real board, or by real users.
