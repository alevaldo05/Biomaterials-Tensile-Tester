# Branches, backups, and how changes are organized

| Place | What it is |
|---|---|
| Tag `backup-YYYY-MM-DD` | A frozen copy of the site at one moment. Never edited or moved. The first is `backup-2026-11-07` (the site just before deployment was added). |
| `main` | The reviewed, working version. It is also what is published. It changes only when the owner merges a pull request. |
| Short-named branches | One change each, started from the latest `main` (for example `deploy-pages`, `about-page`). After the pull request is merged the branch is no longer needed. |
| Tag `v1.0` (later) | A release milestone, chosen by the owner. |

## Making a backup

On GitHub: **Releases**, **Draft a new release**, **Choose a tag**, type a name such as `backup-2026-12-01`, choose **Create new tag on publish**, set the target to `main`, then **Publish release**. The release page offers a ZIP of that moment. Do this before a large change.

## Going back to a backup

- To look at it: open the tag on GitHub (the **Releases** or **Tags** list), or download its ZIP.
- To make `main` match it again without rewriting history: create a branch from the tag, open a pull request into `main`, and merge it. The site redeploys.

## Rules

- Each change gets its own branch from the latest `main`. Branches are not stacked.
- Nothing goes to `main` except through a pull request the owner merges.
- Old branches are left alone. Deleting them is the owner's choice.
- Optional, owner-only: in **Settings**, **Branches**, protect `main` (require a pull request, block force-pushes and deletion).
