# Editing the website text

You can change the paragraphs on the Home, Learn, and About pages without touching any page code. The words live in plain files in `data/text/`. This guide says what is safe to change and how to check your work. Nothing you type is uploaded or saved anywhere except in the file itself.

## Where the words are

| Page | Text file | Page file (do not edit for wording) |
|---|---|---|
| Home | `data/text/home.js` | `index.html` |
| Learn | `data/text/learn.js` | `learn.html` |
| About | `data/text/about.js` | `about.html` |
| Help (Troubleshooting and Keyboard) | `data/text/help.js` | `help.html` |
| Help (the numbered reference list) | `data/references.js` | `help.html` |

Other files that hold words and are already easy to edit: `data/protocols.js` (protocol steps), `data/materials.js` (material values), `data/checklist.js` (the "Before you test" items, used on the Learn page and in the optional pre-test pop-up), `data/articles.js` (Further reading links). More pages will move to `data/text/` over time.

## How to edit

1. Open the text file in a plain text editor (Notepad, TextEdit set to plain text, VS Code, or similar). Do not use Word.
2. Change only the words **between the quotation marks**. Keep every quotation mark, comma, square bracket `[ ]`, and curly brace `{ }` exactly where it is.
3. Save the file.
4. Open `check-text.html` in the browser (Ctrl+Shift+R to refresh). It says whether every file is readable and, if not, which file and line to look at.
5. Open the page itself and read your change.

## What you can type inside the quotation marks

| Type this | You get |
|---|---|
| `**important**` | **important** (bold) |
| `*title*` | *title* (italic) |
| `[Read more](about.html)` | a link to another page (also `https://...` links) |
| `{E}` | the variable *E* in italics |
| `{A}_{0}` | A with a subscript 0 |
| `m^{2}` | m with a superscript 2 |

Type symbols directly: σ ε Δ × ² – ’ →. Do not type HTML tags: anything like `<b>` is shown as typed, not run. A straight double quote inside text must be written as `\"`; it is easier to use curly quotes “like this”.

## Common changes

- **Change a paragraph:** edit the sentence between the quotation marks.
- **Add a paragraph:** copy an existing line such as `"Some sentence.",` and paste it below, then edit it. Every item in a list ends with a comma.
- **Add a glossary term (Learn page):** copy a line like `[ "Tare", "Zeroing the force reading before a test." ],`, paste it below the last term, and edit the two phrases.
- **Add a list bullet:** copy a line inside a `list: [ ... ]` and edit it.
- **Add a table row (About page):** copy a whole row `[ "Topic", "Text A", "Text B" ],` and edit it. Every row must have the same number of cells as the heading row.
- **Change a section heading or its tab name:** edit `heading:` or `tab:` for that section. (The HTML page keeps a copy of each heading only as a fallback.)
- **Change the "Before you test" list:** edit `data/checklist.js`, not the Learn file.
- **Change the label of the "Print blank run sheet" button (Learn page):** edit `printButton:` in `data/text/learn.js`. Delete that line to remove the button.

## What not to change

- The section keys such as `"about-title"` or `"gloss-title"`: they link a section to its place on the page. Do not rename, delete, or reorder them.
- The words that name a type of block: `p`, `note`, `list`, `terms`, `glossary`, `columns`, `table`, `steps`, `linklist`, `articles`, `pretest`, `heading`, `tab`, `blocks`, `head`, `rows`, `labels`.
- The `.html`, `.css`, and other `.js` files. They control how pages look and work.

## If something goes wrong

- A section shows a box saying "This text could not be shown": open `check-text.html`. It names the file, the section, and (for a typing mistake) the line the browser stopped at. A missing comma or quotation mark just above that line is the usual cause.
- Other sections and pages keep working even when one file has a mistake.
- You can always undo by restoring the file from GitHub. Follow your branch-and-pull-request process before any change reaches `main`.

## About the words themselves

Keep claims honest. Do not state numbers, standards, or results you cannot support, label sample or simulated data as such, and keep draft and untested wording where it applies. Any wording change that affects what a result means should be reviewed with your advisor.
