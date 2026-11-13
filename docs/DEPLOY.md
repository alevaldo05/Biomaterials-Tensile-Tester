# Publishing the site

The site is published with GitHub Pages. When a pull request is merged into `main`, a GitHub workflow (`.github/workflows/deploy.yml`) publishes it. You do not download anything or run any commands.

Expected address: <https://alevaldo05.github.io/Biomaterials-Tensile-Tester/> (confirm it on the first deploy; see below).

## One-time setup (repository owner)

1. On GitHub open the repository, then **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Merge the pull request that adds the workflow. The first deploy starts by itself. If GitHub asks you to approve the `github-pages` environment, approve it.

## Changing the site

1. Make the change on a short-named branch and open a pull request into `main`.
2. Merge it. Deployment starts within a few seconds.
3. Wait for the green check (below), then refresh the site.

## How to tell that deployment is finished

1. Open the repository's **Actions** tab and find the newest run named **Deploy site**.
   - Yellow dot or spinner: still running (usually under two minutes).
   - Green check: the checks passed and the new version is live. The run has two parts, **checks** and **deploy**.
   - Red cross: it failed. Open the run, then the step with the red cross, to read why. The site keeps showing the previous version.
2. The run page shows the live address under the **Deploy to GitHub Pages** step. **Settings**, **Pages** also shows "Your site is live at ...".
3. Open `/version.json` on the site (for example `https://alevaldo05.github.io/Biomaterials-Tensile-Tester/version.json`). Its `short` value must equal the first seven characters of the newest commit on `main`.
4. Refresh the page. A normal refresh is enough. If a browser still shows the old page, press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).

To publish again without a new commit: **Actions**, **Deploy site**, **Run workflow**.

## How visitors get updated files

GitHub Pages lets browsers keep a file for up to 10 minutes and the setting cannot be changed. To avoid old files, the workflow adds the commit number to every script and stylesheet address in the published copy (for example `graph.js?v=17b7cfc`). A new commit means new addresses, so the browser fetches the new files straight away. The HTML pages themselves are checked with the server on each visit. The files in the repository are never changed by this; only the published copy is.

The icon files are not stamped with the commit number, and browsers keep a site's icon for a long time. If an old icon still shows, open the site in a new tab or press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).

## What is published

Everything except the Git files, the workflow, `scripts/`, `docs/`, the `.md` documents, and the app workspace folders. The copy is made by `scripts/build-site.sh`. The workflow also builds the tester app's learning edition (simulation and replay only, no USB, no sign-in) and publishes it at `app/`; if that build fails, nothing is published.

## Checks before publishing

Before anything is published, `scripts/check-site.js` runs on GitHub. If any check fails, the deploy stops and the live site keeps its previous version. Pull requests run the same checks, so a red check shows before you merge.

It looks at:

1. **Page links:** every script, style sheet, and page that a page links to exists.
2. **Script syntax:** every `.js` file is valid JavaScript (a missing quote, comma, or bracket is caught).
3. **Data files:** the files in `data/` load in the order each page lists them and contain what the pages need (materials, example curves, protocols, references numbered 1, 2, 3 ... with none missing, page text, device settings).
4. **Duplicate files:** no two files have the same content, which catches a file put in the wrong folder.
5. **Build output:** the publish step stamps every link, writes `version.json`, and leaves out documents and scripts.
6. **Private details:** no email address (except a GitHub no-reply one) and no key or token in any file.
7. **Publishing workflow:** every Action in `.github/workflows/` is pinned to a full commit ID, not a tag.
8. **Security policy and inline code:** every page has the Content Security Policy tag (script sources limited to the site's own files, tag placed before the first script) and the no-referrer tag, and no page has an inline `<script>`, an `onclick=`-style handler, or a `javascript:` link. Page scripts must not build any either.
9. **Public-site basics:** every page has a description (200 characters or fewer) and an icon link, no link starts with a bare `/`, and `404.html` and the icon files exist.
10. **Skip link:** every page except `404.html` starts with the "Skip to main content" link and has `id="main-content"` on `<main>`.

To read a failure: open the **Actions** tab, open the run, then **checks**, then **Check the site**. Each line starting with `FAIL` names the file and what to fix. Fix it on a branch and merge again.

To run the checks on your own computer (needs Node.js): `node scripts/check-site.js`

The checks do not test calculations, how pages look, other browsers, or the tester hardware.

## Updating a pinned Action

The workflow names each Action by its full commit ID (with the version in a comment), so GitHub runs exactly
that code even if the Action's tag is moved. Check 7 fails if a tag creeps back in. Nothing updates by itself:
`.github/dependabot.yml` is switched off (its limit is 0). To turn on weekly update pull requests, change the 0
to 2 in a pull request you merge; the updates then arrive as pull requests that you read and merge like any
other change.

To update one by hand, get the new ID from GitHub, never from memory:

`git ls-remote --tags https://github.com/actions/deploy-pages`

Use the ID next to the version tag you want, and update the version in the comment. Wait for the green
**checks** run before merging. That job does not run the publish steps, so after merging an update to a
publish Action, watch the next **Deploy site** run; if it fails, use **Revert** on the pull request.

Settings only the repository owner can change (protecting `main`, two-factor sign-in, secret scanning) are
listed in [REPO-SETTINGS.md](REPO-SETTINGS.md).

## If something goes wrong

- **Undo a change:** on the merged pull request choose **Revert**, then merge the revert pull request. The site redeploys the previous version.
- **Go back to a saved copy:** see [BRANCHES.md](BRANCHES.md).
- **Workflow shows a red cross before it starts:** check that Pages **Source** is set to **GitHub Actions**.
- **A check fails:** see "Checks before publishing" above. The live site is unchanged until the problem is fixed and merged.

## Notes

- Pages serves the site over https. The website itself has no USB (Web Serial) connection; the tester's USB connection is in the tester app, and the hardware connection is still untested.
- Test data stays in the visitor's browser tab and is never uploaded.
