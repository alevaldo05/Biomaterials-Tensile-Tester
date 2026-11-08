/* Page text from plain files (data/text/*.js). Fills the sections of Home, Learn, and About from the
   words you edit in those files, so you never have to touch the page HTML to change a paragraph.
   Nothing here is stored or sent anywhere. If a text file has a mistake, the affected section shows a
   visible box (it never breaks the rest of the page) and check-text.html says what to fix.

   Page layout (headings, ids, layouts, tabs) stays in the HTML. Words live in data/text/.
   Allowed markup inside text: **bold**, *italic*, [link text](page.html or https://...), {E} for a
   variable (italic), _{0} for a subscript, and ^{2} for a superscript. Everything else is plain text;
   HTML typed into a text file is shown as typed, not run. */
(function () {
  'use strict';

  /* Which sections each page's text file must provide (the ids of the <h2> headings in the HTML). */
  var PAGES = {
    home: { file: 'data/text/home.js', sections: ['about-title', 'how-title', 'proto-title'] },
    learn: { file: 'data/text/learn.js', sections: ['before-title', 'bg-title', 'gloss-title'] },
    help: { file: 'data/text/help.js', sections: ['trouble-title', 'keys-title', 'helprefs-title'] },
    about: { file: 'data/text/about.js', sections: ['measures-title', 'why-title', 'compare-title', 'skin-title', 'time-title', 'skin-why-title', 'limits-title', 'status-title', 'refs-title'] }
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function need(cond, msg) { if (!cond) throw new Error(msg); }
  function isStr(v) { return typeof v === 'string'; }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  /* ---------- inline markup ---------- */
  var SAFE_URL = /^(https?:\/\/[^\s"<>]+|[A-Za-z0-9_\-./]+\.html(#[A-Za-z0-9_\-]*)?|#[A-Za-z0-9_\-]+)$/;
  function inline(s) {
    need(isStr(s), 'This should be text in quotation marks.');
    var h = esc(s);
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, text, url) {
      var u = url.replace(/&amp;/g, '&');
      return SAFE_URL.test(u) ? '<a href="' + esc(u) + '">' + text + '</a>' : m;
    });
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    h = h.replace(/_\{([^}]*)\}/g, '<sub>$1</sub>');
    h = h.replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>');
    h = h.replace(/\{([^}]*)\}/g, '<var>$1</var>');
    return h;
  }

  /* ---------- blocks ---------- */
  function strList(v, what) {
    need(isArr(v), what + ' should be a list in square brackets, like [ "one", "two" ].');
    v.forEach(function (x) { need(isStr(x), what + ' should contain only text in quotation marks.'); });
    return v;
  }
  function pairs(v, what) {
    need(isArr(v), what + ' should be a list of [ "term", "definition" ] pairs.');
    return v.map(function (p) {
      need(isArr(p) && p.length === 2 && isStr(p[0]) && isStr(p[1]), 'Each entry in ' + what + ' should look like [ "term", "definition" ].');
      return '<dt>' + inline(p[0]) + '</dt><dd>' + inline(p[1]) + '</dd>';
    }).join('');
  }
  var RENDER = {
    p: function (b) { return '<p>' + inline(b.p) + '</p>'; },
    note: function (b) { return '<p class="muted">' + inline(b.note) + '</p>'; },
    h3: function (b) { return '<h3>' + inline(b.h3) + '</h3>'; },
    list: function (b) {
      var cls = b.style === 'plain' ? '' : ' class="checklist"';
      return '<ul' + cls + '>' + strList(b.list, '"list"').map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>';
    },
    terms: function (b) { return '<div class="glossary"><dl>' + pairs(b.terms, '"terms"') + '</dl></div>'; },
    glossary: function (b) {
      return '<details class="glossary"' + (b.open === false ? '' : ' open') + '><summary>' + inline(b.summary || 'Show terms') + '</summary><dl>' + pairs(b.glossary, '"glossary"') + '</dl></details>';
    },
    columns: function (b) {
      need(isArr(b.columns), '"columns" should be a list of columns.');
      return '<div class="two-col">' + b.columns.map(function (c) {
        need(c && isArr(c.blocks), 'Each column needs "blocks": [ ... ].');
        return '<div>' + (c.heading ? '<h3>' + inline(c.heading) + '</h3>' : '') + blocks(c.blocks) + '</div>';
      }).join('') + '</div>';
    },
    table: function (b) {
      var t = b.table;
      need(t && isArr(t.head) && isArr(t.rows), '"table" needs head: [ ... ] and rows: [ [ ... ], ... ].');
      var labels = t.labels || [];
      return '<table class="eqs compare"><thead><tr>' + strList(t.head, '"head"').map(function (x) { return '<th scope="col">' + inline(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        t.rows.map(function (r) {
          strList(r, 'Each table row');
          need(r.length === t.head.length, 'Every table row needs the same number of cells as the heading row (' + t.head.length + ').');
          return '<tr><th scope="row">' + inline(r[0]) + '</th>' + r.slice(1).map(function (c, i) {
            return '<td data-label="' + esc(labels[i] || t.head[i + 1]) + '">' + inline(c) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    },
    steps: function (b) {
      need(isArr(b.steps), '"steps" should be a list of { title: "...", text: "..." }.');
      return '<ol class="steps">' + b.steps.map(function (s) {
        need(s && isStr(s.title) && isStr(s.text), 'Each step needs title: "..." and text: "...".');
        return '<li><h3>' + inline(s.title) + '</h3><p>' + inline(s.text) + '</p></li>';
      }).join('') + '</ol>';
    },
    linklist: function (b) {
      need(isArr(b.linklist), '"linklist" should be a list of { link: "[text](page.html)", note: "..." }.');
      return '<ul class="link-list">' + b.linklist.map(function (x) {
        need(x && isStr(x.link), 'Each entry needs link: "[text](page.html)".');
        return '<li>' + inline(x.link) + (x.note ? ' <span class="muted">' + inline(x.note) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    },
    articles: function (b) {
      need(isArr(b.articles), '"articles" should be a list of { text: "...", note: "..." }.');
      return '<ul class="articles">' + b.articles.map(function (x) {
        need(x && isStr(x.text), 'Each entry needs text: "...".');
        return '<li>' + inline(x.text) + (x.note ? '<span class="note">' + inline(x.note) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    },
    /* the "Before you test" items come from data/checklist.js, so they are written in one place only */
    /* the References list comes from data/references.js (37 entries, numbered); each entry gets an id like ref-13 */
    references: function () {
      var R = window.REFERENCES;
      need(R && isArr(R.groups), 'The reference file data/references.js did not load.');
      return (R.note ? '<p class="muted">' + inline(R.note) + '</p>' : '') + R.groups.map(function (g) {
        need(g && isStr(g.name) && isArr(g.items), 'Each reference group needs name: "..." and items: [ ... ].');
        return '<h3>' + inline(g.name) + '</h3>' + (g.intro ? '<p class="muted small">' + inline(g.intro) + '</p>' : '') + '<ul class="ref-list">' + g.items.map(function (it) {
          need(it && typeof it.n === 'number' && isStr(it.text), 'Each reference needs n: (a number) and text: "...".');
          var link = it.link && SAFE_URL.test(it.link) ? ' <a href="' + esc(it.link) + '">Open source</a>' : '';
          return '<li id="ref-' + it.n + '"><span class="ref-n">[' + it.n + ']</span> ' + inline(it.text) + link +
            (it.access ? ' <span class="muted small">(' + inline(it.access) + ')</span>' : '') +
            (it.scope ? '<br><span class="small">Scope: ' + inline(it.scope) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
      }).join('');
    },
    pretest: function (b) {
      var C = window.PRETEST_CHECKLIST;
      need(C && isArr(C.groups), 'The checklist file data/checklist.js did not load.');
      need(b.printButton === undefined || isStr(b.printButton), 'printButton should be text in quotation marks.');
      /* The "print blank run sheet" button appears only if the page loaded report.js (the Learn page does). */
      var btn = isStr(b.printButton) && b.printButton && window.TensileReport && window.TensileReport.printBlank
        ? '<div class="graph-actions"><button type="button" class="btn-secondary" data-runsheet>' + esc(b.printButton) + '</button></div>' : '';
      return '<div class="two-col">' + C.groups.map(function (g) {
        return '<div><h3>' + esc(g.name) + '</h3><ul class="checklist">' + g.items.map(function (it) { return '<li>' + esc(it.text) + '</li>'; }).join('') + '</ul></div>';
      }).join('') + '</div>' + btn;
    }
  };
  var ORDER = ['references', 'pretest', 'columns', 'glossary', 'terms', 'table', 'steps', 'linklist', 'articles', 'list', 'h3', 'note', 'p'];

  function block(b) {
    if (isStr(b)) return '<p>' + inline(b) + '</p>';
    need(b && typeof b === 'object' && !isArr(b), 'Each item should be text in quotation marks or a { ... } block.');
    for (var i = 0; i < ORDER.length; i++) if (b[ORDER[i]] !== undefined) return RENDER[ORDER[i]](b);
    throw new Error('A block is missing its type. Use one of: p, note, h3, list, terms, glossary, columns, table, steps, linklist, articles, pretest, references.');
  }
  function blocks(list) {
    need(isArr(list), '"blocks" should be a list in square brackets.');
    return list.map(block).join('');
  }

  /* ---------- filling a page ---------- */
  function errorBox(msg, file) {
    return '<div class="text-error" role="alert"><strong>This text could not be shown.</strong> ' + esc(msg) +
      (file ? ' File: <code>' + esc(file) + '</code>.' : '') + ' <a href="check-text.html">Open the text checker</a> to see what to fix.</div>';
  }
  function headingText(h2, text) {
    var node = null, i;
    for (i = 0; i < h2.childNodes.length; i++) if (h2.childNodes[i].nodeType === 3) { node = h2.childNodes[i]; break; }
    if (!h2.children.length) h2.textContent = text;
    else if (node) node.nodeValue = text + ' ';
  }
  var PAGE_FIELDS = {
    sub: { home: '.hero .sub', learn: 'main > p.sub', help: 'main > p.sub', about: null },
    status: { about: 'main > p.status .muted' }
  };

  function apply(pageKey) {
    var cfg = PAGES[pageKey];
    if (!cfg) return;
    var data = window.SITE_TEXT && window.SITE_TEXT[pageKey];
    cfg.sections.forEach(function (id) {
      var h2 = document.getElementById(id);
      if (!h2) return;
      var sec = h2.closest('section');
      var html;
      if (!data || !data.sections || !data.sections[id]) {
        html = errorBox(data ? 'There is no text for the section "' + id + '".' : 'The text file did not load or has a mistake.', cfg.file);
      } else {
        try {
          var s = data.sections[id];
          html = blocks(s.blocks);
          if (isStr(s.heading)) headingText(h2, s.heading);
          if (isStr(s.tab) && sec) sec.setAttribute('data-tab', s.tab);
        } catch (e) { html = errorBox('Section "' + id + '": ' + e.message, cfg.file); }
      }
      while (h2.nextSibling) h2.parentNode.removeChild(h2.nextSibling);
      h2.insertAdjacentHTML('afterend', html);
    });
    ['sub', 'status'].forEach(function (field) {
      var sel = PAGE_FIELDS[field][pageKey];
      var el = sel ? document.querySelector(sel) : null;
      if (el && data && isStr(data[field])) { try { el.innerHTML = inline(data[field]); } catch (e) { el.innerHTML = errorBox(e.message, cfg.file); } }
    });
  }

  /* ---------- used by check-text.html ---------- */
  function validate(pageKey) {
    var cfg = PAGES[pageKey], data = window.SITE_TEXT && window.SITE_TEXT[pageKey], out = { file: cfg.file, loaded: !!data, problems: [], missing: [], ok: 0, html: {} };
    if (!data) return out;
    cfg.sections.forEach(function (id) {
      var s = data.sections && data.sections[id];
      if (!s) { out.missing.push(id); return; }
      try { out.html[id] = blocks(s.blocks); out.ok++; } catch (e) { out.problems.push({ section: id, message: e.message }); }
    });
    ['sub', 'status'].forEach(function (f) { if (data[f] !== undefined) { try { inline(data[f]); } catch (e) { out.problems.push({ section: f, message: e.message }); } } });
    if (data.cards !== undefined) {
      Object.keys(data.cards).forEach(function (k) { if (!isStr(data.cards[k])) out.problems.push({ section: 'cards.' + k, message: 'This should be text in quotation marks.' }); });
    }
    return out;
  }

  window.SiteText = { PAGES: PAGES, inline: inline, esc: esc, apply: apply, validate: validate };
  var page = document.documentElement.getAttribute('data-text-page') || (document.body && document.body.getAttribute('data-text-page'));
  if (page) apply(page);
})();
