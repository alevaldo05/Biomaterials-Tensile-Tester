# Publishing the site

The site is published with GitHub Pages. When a pull request is merged into `main`, a GitHub workflow (`.github/workflows/deploy.yml`) publishes it. You do not download anything or run any commands.

Expected address: <https://alevaldo05.github.io/Senior-Design-Tensile-Tester/> (confirm it on the first deploy; see below).

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
   - Green check: the new version is live.
   - Red cross: it failed. Open the run, then the step with the red cross, to read why. The site keeps showing the previous version.
2. The run page shows the live address under the **Deploy to GitHub Pages** step. **Settings**, **Pages** also shows "Your site is live at ...".
3. Open `/version.json` on the site (for example `https://alevaldo05.github.io/Senior-Design-Tensile-Tester/version.json`). Its `short` value must equal the first seven characters of the newest commit on `main`.
4. Refresh the page. A normal refresh is enough. If a browser still shows the old page, press Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).

To publish again without a new commit: **Actions**, **Deploy site**, **Run workflow**.

## How visitors get updated files

GitHub Pages lets browsers keep a file for up to 10 minutes and the setting cannot be changed. To avoid old files, the workflow adds the commit number to every script and stylesheet address in the published copy (for example `graph.js?v=17b7cfc`). A new commit means new addresses, so the browser fetches the new files straight away. The HTML pages themselves are checked with the server on each visit. The files in the repository are never changed by this; only the published copy is.

## What is published

Everything except the Git files, the workflow, `scripts/`, `docs/`, and the `.md` documents. The copy is made by `scripts/build-site.sh`.

## If something goes wrong

- **Undo a change:** on the merged pull request choose **Revert**, then merge the revert pull request. The site redeploys the previous version.
- **Go back to a saved copy:** see [BRANCHES.md](BRANCHES.md).
- **Workflow shows a red cross before it starts:** check that Pages **Source** is set to **GitHub Actions**.

## Notes

- Pages serves the site over https, so USB (Web Serial) works in Chrome. The hardware connection is still untested.
- Test data stays in the visitor's browser tab and is never uploaded.
