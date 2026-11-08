# Repository settings only the owner can change

These protect the repository and the published site. They are changed on GitHub, in the browser, by the
repository owner. Menu names change from time to time; look for the wording below and confirm on the page.
None of this is needed to run the site. None of it protects against a stolen GitHub account, so item 1 matters most.

1. **Account.** Turn on two-factor authentication or a passkey for the GitHub account. Keep recovery codes
   somewhere offline.
2. **Protect `main`.** Settings, Rules (rulesets): add a rule for the `main` branch that requires a pull
   request, requires the `checks` check to pass, blocks force pushes, and blocks deletion. Decide whether
   you let yourself bypass it.
3. **Secret scanning.** Settings, Code security: turn on secret scanning and push protection. "Dependabot
   alerts" only notify you; leave "Dependabot security updates" off unless you want GitHub to open pull
   requests by itself.
4. **HTTPS.** Settings, Pages: "Enforce HTTPS" ticked.
5. **Actions.** Settings, Actions, General: workflow permissions set to read-only by default. Optionally allow
   only actions made by GitHub (`actions/*`), and turn on the option that requires actions to be pinned to a
   full commit ID, if it is offered.
6. **Pages environment.** Settings, Environments, `github-pages`: deployment branches limited to `main`.
7. **Old repository.** `Senior-Design-Tensile-Tester` stays private: its history still holds an old email
   address and old attribution lines. Do not delete it.
8. **Backups.** Before a large change, make a Release (for example `backup-2026-12-01`) as described in
   [BRANCHES.md](BRANCHES.md).

Pinned actions and Dependabot are described in [DEPLOY.md](DEPLOY.md).
