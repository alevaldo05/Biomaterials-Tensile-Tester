/* The Load Test workspace (window.LoadShell). Like the test pages (live-shell.js), it only MOVES the markup the page already has:
     a File sidebar (mode, test type, the tutorial spot, and the CSV format help) beside a workspace with a toolbar (the Choose file buttons and their
     messages), a strip of facts read from the loaded file, and the graph with its panels (graph.js). Compare mode shows its overlay graph and table in
     the same workspace. The strip shows only what the file holds (a dash when something is missing); nothing is invented, saved, or sent.
   load-test.js calls LoadShell.setRecord(record) after it opens a file and LoadShell.clear() when the file is closed. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  var main = document.querySelector('main'), form = $('load-form'), graph = $('graph-app'), cmp = $('compare-app');
  if (!main || !form || !graph) { window.LoadShell = { setRecord: function () {}, clear: function () {} }; return; }
  var mq = window.matchMedia ? window.matchMedia('(max-width: 68.75rem)') : null, narrow = { matches: false };

  /* The layout takes the classes the test pages use, so the sidebar, the panels, and the graph rules in css/workspace.css apply here too.
     A loaded file is already a finished test, so "ended" and "has-run" are always set. */
  var layout = el('div', 'live-layout load-layout ended has-run');
  form.parentNode.insertBefore(layout, form);
  /* "Narrow" means the sidebar is a drawer: the window is 1100 px or narrower, or the room for the workspace is under 60rem (large text makes rem bigger). */
  function measure() {
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, w = layout.parentNode ? layout.parentNode.clientWidth : window.innerWidth;
    narrow.matches = !!(mq && mq.matches) || w < 60 * rem; layout.classList.toggle('ws-narrow', narrow.matches);
  }
  measure();

  var side = el('aside', 'ws-side'); side.id = 'ws-side'; side.setAttribute('aria-label', 'File and test type');
  var head = el('div', 'ws-side-head', '<h2 class="ws-side-title">File</h2><button type="button" class="btn-secondary btn-small" id="ws-side-toggle" aria-expanded="true" aria-controls="ws-side-body"></button>');
  var body = el('div', 'ws-side-body'); body.id = 'ws-side-body';
  side.appendChild(head); side.appendChild(body);

  var workMain = el('div', 'live-main');

  /* the Choose file buttons and their messages go in the toolbar; the mode and the test type stay in the sidebar */
  var one = $('mode-one'), many = $('mode-compare');
  var bar = el('div', 'control-bar ws-toolbar');
  var setupOpen = el('button', 'btn-secondary ws-setup-open', 'File options'); setupOpen.type = 'button'; setupOpen.id = 'ws-setup-open';
  var grp = el('div', 'ws-grp ws-grp-file'); grp.setAttribute('role', 'group'); grp.setAttribute('aria-label', 'File');
  grp.appendChild(el('span', 'ws-grp-t', 'File'));
  if (one) grp.appendChild(one);
  if (many) grp.appendChild(many);
  bar.appendChild(setupOpen); bar.appendChild(grp);

  /* the strip */
  var strip = el('div', 'ws-strip'); strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', 'Facts from the loaded file');
  function cell(term, label, id, unit, cls) {
    return '<div class="ws-cell' + (cls ? ' ' + cls : '') + '"><span class="ws-k" data-term="' + term + '" tabindex="0">' + label + '</span><span class="ws-v" data-term="' + term + '"><b id="' + id + '">—</b>' + (unit ? ' ' + unit : '') + '</span></div>';
  }
  strip.innerHTML =
    cell('lt_points', 'Points', 'lt-n', '') +
    cell('lt_peakF', 'Peak force', 'lt-f', 'N') +
    cell('stress', 'Peak stress', 'lt-s', 'MPa') +
    cell('lt_duration', 'Duration', 'lt-t', 's') +
    cell('ws_src', 'Data', 'lt-src', '', 'ws-src') +
    cell('lt_dims', 'Dimensions', 'lt-dim', '', 'ws-src');

  workMain.appendChild(bar); workMain.appendChild(strip); workMain.appendChild(graph);
  if (cmp) workMain.appendChild(cmp);

  /* the sidebar holds what is left in the form: mode, test type, the tutorial spot, and the CSV format help */
  body.appendChild(form);
  layout.appendChild(side); layout.appendChild(workMain);

  /* sidebar: hide, show, drawer on narrow windows */
  var toggle = head.querySelector('#ws-side-toggle');
  function label() {
    var collapsed = layout.classList.contains('ws-collapsed');
    if (narrow.matches) { toggle.textContent = 'Close'; toggle.setAttribute('aria-label', 'Close file options'); toggle.setAttribute('aria-expanded', String(side.classList.contains('is-open'))); return; }
    toggle.textContent = collapsed ? '»' : '« Hide'; toggle.setAttribute('aria-label', collapsed ? 'Show file options' : 'Hide file options'); toggle.setAttribute('aria-expanded', String(!collapsed));
  }
  function collapse(on) { layout.classList.toggle('ws-collapsed', !!on); if (!on) side.classList.remove('is-open'); label(); }
  toggle.addEventListener('click', function () {
    if (narrow.matches) { side.classList.remove('is-open'); setupOpen.focus(); label(); return; }
    collapse(!layout.classList.contains('ws-collapsed'));
  });
  setupOpen.addEventListener('click', function () { side.classList.add('is-open'); label(); toggle.focus(); });
  function onWidth() { measure(); if (!narrow.matches) side.classList.remove('is-open'); label(); }
  if (window.ResizeObserver) new ResizeObserver(function () { onWidth(); }).observe(layout.parentNode); else window.addEventListener('resize', onWidth);
  label();

  /* the strip follows the mode: it belongs to the one-file graph, not to Compare mode */
  function syncStrip() { strip.hidden = graph.hidden; }
  if (window.MutationObserver) new MutationObserver(syncStrip).observe(graph, { attributes: true, attributeFilter: ['hidden'] });
  syncStrip();

  function setText(id, v) { var n = $(id); if (n && n.textContent !== v) n.textContent = v; }
  function num(v, dp) { return v === null || v === undefined || !isFinite(v) ? '—' : v.toFixed(dp); }
  function maxOf(a) { var m = -Infinity; for (var i = 0; i < a.length; i++) if (isFinite(a[i]) && a[i] > m) m = a[i]; return m === -Infinity ? null : m; }

  window.LoadShell = {
    clear: function () {
      ['lt-n', 'lt-f', 'lt-s', 'lt-t'].forEach(function (id) { setText(id, '—'); });
      setText('lt-src', 'No file yet'); setText('lt-dim', '—');
    },
    /* r: the record graph.js made from the file (uniaxial: strain and stress; relaxation: time and stress; r.raw holds the readings when the file had them) */
    setRecord: function (r) {
      var raw = r.raw || {}, T = raw.t && raw.t.length ? raw.t : (r.checkT && r.checkT.length ? r.checkT : null);
      var TG = window.TensileGraph;
      setText('lt-n', String(r.x.length));
      setText('lt-f', raw.F && raw.F.length ? num(maxOf(raw.F), 2) : '—');
      setText('lt-s', num(maxOf(r.y), 2));
      setText('lt-t', T ? num(T[T.length - 1], 1) : (r.test === 'relaxation' && r.x.length ? num(r.x[r.x.length - 1], 1) : '—'));
      setText('lt-src', 'Loaded file' + (r.simulated ? ' (declared simulated, not measured)' : ' (data origin not verified)'));
      var ds = TG && TG.dimSourceText ? TG.dimSourceText(r) : '';
      setText('lt-dim', ds ? ds.charAt(0).toUpperCase() + ds.slice(1) : '—');
    }
  };
  window.LoadShell.clear();
})();
