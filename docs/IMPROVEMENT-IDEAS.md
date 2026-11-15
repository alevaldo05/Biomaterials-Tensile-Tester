# Improvements: sign-in, spacing, and ten more (November 2026)

This records what was asked for, what was proposed, and what was built on the branch `operator-sign-in`, why each helps, and what is still untried. Wording marked **draft** is for the owner's review.

Everything below was checked on Linux only: Chromium, and Playwright's WebKit (the engine behind Safari, not Safari on a Mac). Nothing was tried on a Windows computer, with a real board, or by real users.

## Asked for by the owner

| What | Built | Where | Still untried |
|---|---|---|---|
| Sign-in to run the machine: each operator signs in with their own name and password; students get their own credentials; an operator gives students access; the admin decides who has access; a student's tests always name the responsible operator, chosen before the test, and anyone but the person who gave access confirms with their own password | Yes | `docs/app/SIGN-IN.md`; `apps/desktop/people.cjs`; the app's People screen, sign-in boxes, and Test screen Connection step | Windows; real users |
| No passwords on the website | Kept: the website has no sign-in and saves nothing | `learn.html` (Getting access) | — |
| Spacing: nothing cluttered or crowded | A spacing check for every website page and app screen at 1366, 1280, 1024, 768, and 390 px, light and dark; every problem it and a review of the pictures found is fixed | `scripts/check-spacing.mjs`; `.github/workflows/spacing.yml` | Safari on a Mac; a real Windows window |

## Website (no passwords, nothing saved)

1. **Getting access to the tester** (Learn, and a Help row). *Why:* students learn on the website, and the website is where they will look for how to get onto the machine. *Built:* a short section, draft wording. *Related:* the search finds it.
2. **Practice record.** *Why:* gives an operator something concrete before signing off a student's training ("practice test completed"). *Built:* Print practice record on the practice page after a simulated test, labeled "Simulated data, not measured", with lines for the name and the operator; nothing saved. *Not built:* a typed name (the line is filled in by hand, so nothing is typed or kept).
3. **Spacing check on pull requests.** *Why:* crowding comes back unnoticed after small changes. *Built:* the "Spacing check" workflow fails a pull request on sideways scroll, overlap, controls closer than 4 px, clipped text, or a word split over two lines, and uploads the pictures. *Not yet run on GitHub.*
4. **Safari engine check.** *Why:* Safari on a Mac is a target and has never been tried. *Built:* `--browser=webkit` on the spacing and combination checks, run here: no spacing issue, every feature check passed. Some contrast warnings in WebKit change from run to run and were traced to the measurement, not the pages. *Still needed:* Safari on a real Mac.
5. **Accessibility pass.** *Why:* keyboard and screen-reader users, and fewer surprises. *Built:* `check-site.js` checks the page source (image alt, named controls and buttons, heading order, one h1, lang), and a check that every text section is actually filled (it would have caught an empty section during this work). A keyboard walk of all 14 pages found no trap, no hidden focus, no missing focus ring. *Left as is:* Esc does not close the Need help? card (its X does), because Esc sends STOP on the practice page; the owner may decide otherwise.

## Tester app (all tied to the sign-in)

1. **Usage report.** *Why:* the admin and operators see who uses the machine, how much, and who was responsible. *Built:* People > Usage (tests run, recording time, tests as responsible operator, last use) with a CSV download; the full usage log as CSV for the admin.
2. **Student limits.** *Why:* a new student can be kept to a known method and a gentle speed. *Built:* an operator may limit a student to chosen test methods and a maximum crosshead speed; outside them Start recording is refused and says why (checked in the screens and again in the main process); the limits go into the test file. *Limit of the design:* the app sends no command, so it cannot slow the machine; the speed is what the student enters as the setup.
3. **Training.** *Why:* access only after a safety briefing, knowing where the tester's own STOP is, and a practice test. *Built:* a student signs in freely; at their first test (Connect) they tick every item and any operator or the admin approves with their own password; saved once with the date and name, and written into every test file. (Changed in 1.0.0-beta.3 at the owner's request; it used to be signed off on the People screen before the first sign-in.) Items are draft wording; it is a record, not a safety certification.
4. **People list for a second lab computer.** *Why:* the same accounts on more than one computer. *Built:* the admin copies the list to the lab server and from it (new table and two admin-only routes); hashes go from the Windows app's main process straight to the lab server, never to the screens; a newer change wins and nobody is lost. *Untried:* with a real lab server and two computers.
5. **A check on saved test files.** *Why:* notice when a saved file was edited, by accident or not. *Built:* each saved session file carries a SHA-256 of its contents; Load test says "Unchanged since it was saved", "Changed since it was saved", or "Not checked" for older files. *Limit:* it is not a signature; someone who edits the file can also work out a new check.

## Smaller related ideas (all built)

- "Your access ends in N days" for a student in the last 7 days.
- Add students from a class list (pasted or a CSV), with a preview before adding.
- Printable sign-in slips with the username and first password, kept only on the screen until printed or cleared.
- Switch person at the top right (not while connected or recording).
- Password resets in the usage log.
- Automatic sign-out after 15 minutes without activity (never while connected or recording) and a one-time admin recovery code.
- A lock after wrong passwords that grows: 5 wrong tries lock a username for 1 minute, then 3, 5, 15, and 60 minutes; kept on disk; a right password starts again (1.0.0-beta.3).
- After sign-in, a line names the wrong tries for your username since your last sign-in, so a deliberate lock-out is noticed (1.0.0-beta.3).
- A backup file of the people list (admin), restored with Merge or Replace, with a SHA-256 check; no lab server needed (1.0.0-beta.3).

## Ideas not built (for a later decision)

- **A real lock on the tester:** sign-in keeps casual use off the app, not off the machine. A key switch or an interlock on the tester's own power would need the interface review in `docs/app/TESTER-INTERFACE.md`.
- **Signing test files** with a key held by the lab computer, so a check cannot be redone by someone who edits a file.
- **Live sync** of the people list between computers (today an admin copies it by hand).
- **Esc on the Need help? card**, if the owner wants it (see website item 5).
- **Running the spacing check in WebKit on GitHub** too (it doubles the time of the check).
- **First-start lock-down** (pinned by the owner for later): only a Windows administrator on the computer, or someone with a one-time setup code, can create the first admin, so nobody else can set up a fresh copy and make themselves its admin.
- *Considered and dropped by the owner:* an operator typing the code of a student's printed practice record at the training approval.
