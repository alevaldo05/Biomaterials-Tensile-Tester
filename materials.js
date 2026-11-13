/* Materials page: a grouped Material dropdown and three tabs.
     Material             values for the chosen material, an example graph, and links to its protocol and test
     All properties       one table per family (sortable), and a side-by-side comparison of two materials
     Stiffness vs density Young's modulus against density on log axes, grouped by family, with filters (family,
                          very approximate materials, a name search, names, family outlines) and a list of the materials shown
   The data (typical, unreviewed ranges) is in data/materials.js. Nothing is saved; the link keeps the choice
   (materials.html#al-6061 or #al-6061/chart). */
(function () {
  'use strict';
  var box = document.getElementById('materials-app');
  var MATS = window.MATERIALS, FAMS = window.MATERIAL_FAMILIES, BY = window.MATERIAL_BY_ID;
  if (!box || !MATS || !FAMS) return;

  var TABS = [['material', 'Material'], ['properties', 'All properties'], ['chart', 'Stiffness vs density']];
  var sel = 'steel', tab = 'material', compare = [], sorts = {};
  /* Chart filters: which materials the chart draws. The data itself is never changed, and the filters are not saved or put in the link. */
  var filt = { fams: {}, hideLow: false, q: '', names: false, outlines: true }, focusId = null;
  FAMS.forEach(function (f) { filt.fams[f.id] = true; });
  var LOW_COUNT = MATS.filter(function (m) { return m.low; }).length, MAX_NAMES = 24;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fam(id) { return FAMS.filter(function (f) { return f.id === id; })[0]; }
  function rng(r) { return r ? (r[0] === r[1] ? String(r[0]) : r[0] + '–' + r[1]) : null; }
  function midv(r) { return r ? (r[0] + r[1]) / 2 : -1; }
  /* property column -> entry in data/terms.js; columns with no wording in the project (density, elongation, Poisson's ratio, yield) have no tip */
  var MAT_TERMS = { E: 'youngs', uts: 'uts' };
  var COLS = [
    ['E', 'Young’s modulus (GPa)', function (m) { return rng(m.E); }, function (m) { return midv(m.E); }],
    ['rho', 'Density (kg/m³)', function (m) { return rng(m.rho); }, function (m) { return midv(m.rho); }],
    ['ys', 'Yield (MPa)', function (m) { return rng(m.ys) || 'n/a'; }, function (m) { return midv(m.ys); }],
    ['uts', 'Tensile strength (MPa)', function (m) { return (rng(m.uts) || '—') + (m.utsNote ? ' (' + m.utsNote + ')' : ''); }, function (m) { return midv(m.uts); }],
    ['el', 'Elongation (%)', function (m) { return rng(m.el) || m.elText || 'not established here'; }, function (m) { return midv(m.el); }],
    ['nu', 'Poisson’s ratio', function (m) { return m.nu; }, null]
  ];
  function status(m) { return m.low ? 'Very approximate' : window.MATERIAL_STATUS; }

  /* ---------- marker shapes (shape as well as color tells the families apart) ---------- */
  function shape(f, cx, cy, r, extra) {
    var c = f.color, s = extra || '', i, a, p = [];
    if (f.shape === 'circle') return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c + '" ' + s + '/>';
    if (f.shape === 'square') return '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="' + c + '" ' + s + '/>';
    if (f.shape === 'triangle') return '<path d="M' + cx + ' ' + (cy - r * 1.15) + ' L' + (cx + r * 1.1) + ' ' + (cy + r * 0.9) + ' L' + (cx - r * 1.1) + ' ' + (cy + r * 0.9) + 'Z" fill="' + c + '" ' + s + '/>';
    if (f.shape === 'diamond') return '<path d="M' + cx + ' ' + (cy - r * 1.3) + ' L' + (cx + r * 1.3) + ' ' + cy + ' L' + cx + ' ' + (cy + r * 1.3) + ' L' + (cx - r * 1.3) + ' ' + cy + 'Z" fill="' + c + '" ' + s + '/>';
    if (f.shape === 'pentagon') { for (i = 0; i < 5; i++) { a = -Math.PI / 2 + i * 2 * Math.PI / 5; p.push((cx + r * 1.2 * Math.cos(a)).toFixed(1) + ' ' + (cy + r * 1.2 * Math.sin(a)).toFixed(1)); } return '<polygon points="' + p.join(' ') + '" fill="' + c + '" ' + s + '/>'; }
    if (f.shape === 'cross') { var t = r * 0.4; return '<path d="M' + (cx - t) + ' ' + (cy - r * 1.2) + 'h' + 2 * t + 'v' + (r * 1.2 - t) + 'h' + (r * 1.2 - t) + 'v' + 2 * t + 'h-' + (r * 1.2 - t) + 'v' + (r * 1.2 - t) + 'h-' + 2 * t + 'v-' + (r * 1.2 - t) + 'h-' + (r * 1.2 - t) + 'v-' + 2 * t + 'h' + (r * 1.2 - t) + 'z" fill="' + c + '" ' + s + '/>'; }
    for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; var rr = i % 2 ? r * 0.55 : r * 1.35; p.push((cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1)); }
    return '<polygon points="' + p.join(' ') + '" fill="' + c + '" ' + s + '/>';
  }
  function swatch(f) { return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" class="mat-sw">' + shape(f, 8, 8, 5) + '</svg>'; }

  /* ---------- link in the address bar ---------- */
  function parseHash() {
    var parts = (location.hash || '').replace('#', '').split('/'), o = { id: null, tab: null };
    parts.forEach(function (p) {
      if (BY[p]) o.id = p;
      else if (p === 'properties' || p === 'chart' || p === 'material') o.tab = p;
    });
    return o;
  }
  function setHash() { try { history.replaceState(null, '', '#' + sel + (tab !== 'material' ? '/' + tab : '')); } catch (e) { /* file:// may block this */ } }
  var h0 = parseHash();
  if (h0.id) sel = h0.id;
  if (h0.tab) tab = h0.tab;

  /* ---------- skeleton ---------- */
  box.innerHTML =
    '<div class="mat-pick"><label for="mat-select">Material</label><select id="mat-select">' +
      FAMS.map(function (f) {
        return '<optgroup label="' + esc(f.name) + '">' + MATS.filter(function (m) { return m.family === f.id; }).map(function (m) {
          return '<option value="' + m.id + '">' + esc(m.name) + (m.detail && f.id === 'metals' ? ' (' + esc(m.detail) + ')' : '') + '</option>';
        }).join('') + '</optgroup>';
      }).join('') +
    '</select><span class="tag" id="mat-tag"></span></div>' +
    '<div class="proto-tabs" role="tablist" aria-label="Materials sections">' +
      TABS.map(function (t) { return '<button type="button" role="tab" id="mtab-' + t[0] + '" aria-controls="mpanel-' + t[0] + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') +
    '</div>' +
    '<div class="mat-panel" role="tabpanel" id="mpanel-material" aria-labelledby="mtab-material" tabindex="-1" hidden>' +
      '<div class="mat-overview"><section class="mat-card" id="mat-detail" aria-live="polite"></section>' +
      '<section class="mat-card mat-params" id="mat-params" aria-label="Test parameters"></section>' +
      '<section class="mat-card mat-graphcard"><h2>Example graph</h2><p class="muted small" id="mat-graph-note"></p><div id="mat-graph" data-test="uniaxial"></div></section></div>' +
    '</div>' +
    '<div class="mat-panel" role="tabpanel" id="mpanel-properties" aria-labelledby="mtab-properties" tabindex="-1" hidden>' +
      '<div class="mat-card"><h2>All properties</h2><p class="muted small">Typical, approximate ranges for every material in the list; every row is unreviewed. Select a column heading to sort within a family. Tick <strong>Compare</strong> on two rows to see them side by side. Select a material name to see its details.</p><div id="mat-compare"></div></div>' +
      '<div id="mat-tables"></div>' +
    '</div>' +
    '<div class="mat-panel" role="tabpanel" id="mpanel-chart" aria-labelledby="mtab-chart" tabindex="-1" hidden>' +
      '<div class="mat-card"><h2>Young’s modulus vs density</h2>' +
      '<p class="muted small">This chart compares approximate reported or illustrative property ranges. Values for different materials may come from different conditions and sources; they are not one consistent dataset. The boxes are not probability distributions or confidence intervals, and they do not establish machine capacity or predict a particular specimen. Each box is the typical range for one material, and the marker shows its middle. Color and marker shape both show the family. Select a marker to choose that material; the same values are in the All properties tab. Use the filters to show fewer materials; the list under the chart holds the same values.</p>' +
      toolsHtml() +
      '<p class="small muted chart-keys">Keyboard: Tab to the chart, then use the arrow keys to move between materials (left and right by density, up and down by Young’s modulus), and Enter to choose one.</p>' +
      '<div class="mat-chart-grid"><div class="mat-chart" id="mat-chart"></div><aside id="mat-side" aria-live="polite"></aside></div>' +
      listHtml() + '</div>' +
    '</div>';

  var apiGraph = window.TensileGraph ? window.TensileGraph.mount(document.getElementById('mat-graph'), { test: 'uniaxial', mode: 'example', paramsHost: document.getElementById('mat-params') }) : null;

  /* ---------- tabs ---------- */
  function selectTab(key, focusTab) {
    tab = key;
    TABS.forEach(function (t) {
      var on = t[0] === key;
      var b = document.getElementById('mtab-' + t[0]);
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      document.getElementById('mpanel-' + t[0]).hidden = !on;
    });
    if (focusTab) document.getElementById('mtab-' + key).focus();
  }
  box.querySelectorAll('[role="tab"]').forEach(function (b, i, all) {
    b.addEventListener('click', function () { selectTab(b.getAttribute('data-tab')); setHash(); });
    b.addEventListener('keydown', function (e) {
      var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      selectTab(all[(j + all.length) % all.length].getAttribute('data-tab'), true); setHash();
    });
  });

  /* ---------- Material tab ---------- */
  function detail() {
    var m = BY[sel], f = fam(m.family);
    document.getElementById('mat-tag').textContent = status(m);
    var rows = [
      ['Young’s modulus', (rng(m.E)) + ' GPa' + (m.eText ? ' (' + m.eText + ')' : '')],
      ['Density', rng(m.rho) + ' kg/m³'],
      ['Yield strength', m.ys ? rng(m.ys) + ' MPa' : 'n/a (no clear yield point)'],
      ['Tensile strength', rng(m.uts) + ' MPa' + (m.utsNote ? ' (' + m.utsNote + ')' : '')],
      ['Elongation at failure', m.el ? rng(m.el) + ' %' : (m.elText || 'not established here')],
      ['Poisson’s ratio', m.nu],
      ['What changes the value', m.cond]
    ];
    var rv = m.review || {}, blank = window.MATERIAL_BLANK || 'Not recorded yet';
    var srcRows = [
      ['Source of the values', m.source || blank],
      ['Type of value', m.valueType || blank],
      ['Conditions the values apply to', m.conditions || blank],
      ['Density basis', m.densityBasis || blank],
      ['Review', (rv.status || 'Unreviewed') + (rv.scope && rv.scope !== blank ? ' (scope: ' + rv.scope + ')' : '')],
      ['Reviewer', rv.reviewer || blank],
      ['Review date', rv.date || blank]
    ];
    document.getElementById('mat-detail').innerHTML =
      '<h2>' + swatch(f) + esc(m.name) + '</h2><p class="muted small">' + esc(f.name) + (m.detail ? ' · ' + esc(m.detail) : '') + '</p>' +
      '<p><span class="tag">' + esc(status(m)) + '</span>' + (m.low ? ' <span class="muted small">The literature spread is very wide.</span>' : '') + '</p>' +
      '<dl class="mat-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<h3 class="mat-src-h">Source and review</h3><dl class="mat-dl mat-src">' + srcRows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<p class="mat-links"><a class="btn" href="choose-test.html">Run a test in the tester app</a>' +
      '<a href="practice.html">Practice with a simulated test</a>' +
      '<a href="protocol-uniaxial-tension.html">Open its protocol</a>' +
      '<button type="button" class="linkbtn" id="mat-compare-btn">Compare with another material</button></p>' +
      '<p class="muted small">Real tests are run in the tester app (see New Test). The practice page uses a labeled simulator and does not use this material\u2019s values. The hardware connection is untested.</p>';
    document.getElementById('mat-compare-btn').addEventListener('click', function () {
      if (compare.indexOf(sel) < 0) { compare.push(sel); if (compare.length > 2) compare.shift(); }
      renderTables(); selectTab('properties'); setHash();
    });
    if (apiGraph) {
      var key = m.sample, has = apiGraph.hasMaterial(key);
      document.getElementById('mat-graph').hidden = !has;
      document.getElementById('mat-params').hidden = !has;
      if (has) apiGraph.setMaterial(key, true);
      document.getElementById('mat-graph-note').textContent = has ?
        (key === m.id ? 'Sample data, not measured. Schematic curve generated from illustrative inputs; not experimental data or a validated material model. Its parameters may come from separate illustrative ranges and may not represent one consistent experimental dataset. Region names are educational annotations, not detected material transitions.' :
          'Sample data, not measured. This is the project’s earlier sample curve for ' + m.name.toLowerCase() + '.') : 'No example graph for this material.';
    }
  }

  /* ---------- All properties tab ---------- */
  function renderCompare() {
    var el = document.getElementById('mat-compare');
    if (!compare.length) { el.innerHTML = ''; return; }
    var ms = compare.map(function (id) { return BY[id]; });
    el.innerHTML = '<table class="mt mt-compare"><caption>Side by side <button type="button" class="linkbtn" id="mat-clear">Clear comparison</button></caption><thead><tr><th>Property</th>' +
      ms.map(function (m) { return '<th>' + esc(m.name) + '</th>'; }).join('') + (ms.length < 2 ? '<th class="muted">Tick one more material</th>' : '') + '</tr></thead><tbody>' +
      COLS.map(function (c) { return '<tr><th scope="row">' + c[1] + '</th>' + ms.map(function (m) { return '<td class="n">' + esc(c[2](m)) + '</td>'; }).join('') + (ms.length < 2 ? '<td></td>' : '') + '</tr>'; }).join('') +
      '<tr><th scope="row">What changes the value</th>' + ms.map(function (m) { return '<td>' + esc(m.cond) + '</td>'; }).join('') + (ms.length < 2 ? '<td></td>' : '') + '</tr></tbody></table>';
    document.getElementById('mat-clear').addEventListener('click', function () { compare = []; renderTables(); });
  }
  function renderTables() {
    renderCompare();
    document.getElementById('mat-tables').innerHTML = FAMS.map(function (f) {
      var ms = MATS.filter(function (m) { return m.family === f.id; }), s = sorts[f.id];
      if (s) {
        var col = COLS.filter(function (c) { return c[0] === s.col; })[0];
        ms = ms.slice().sort(function (a, b) { return (col[3](a) - col[3](b)) * s.dir; });
      }
      return '<div class="mat-card"><div class="table-scroll" tabindex="0" role="region" aria-label="' + esc(f.name) + ' properties table"><table class="mt" data-fam="' + f.id + '"><caption><span class="cap">' + swatch(f) + esc(f.name) + '</span></caption>' +
        '<colgroup><col style="width:9%"><col style="width:14%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:9%"><col style="width:8%"><col style="width:12%"><col style="width:10%"></colgroup>' +
        '<thead><tr><th>Compare</th><th>Material</th>' + COLS.map(function (c) {
          var on = s && s.col === c[0];
          return '<th' + (c[3] ? ' aria-sort="' + (on ? (s.dir > 0 ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' + (c[3] ? '<button type="button" class="sortbtn"' + (MAT_TERMS[c[0]] ? ' data-term="' + MAT_TERMS[c[0]] + '"' : '') + ' data-fam="' + f.id + '" data-col="' + c[0] + '">' + c[1] + (on ? (s.dir > 0 ? ' ▲' : ' ▼') : '') + '</button>' : c[1]) + '</th>';
        }).join('') + '<th>What changes the value</th><th>Status</th></tr></thead><tbody>' +
        ms.map(function (m) {
          return '<tr' + (m.id === sel ? ' class="sel"' : '') + '><td><input type="checkbox" data-cmp="' + m.id + '" aria-label="Compare ' + esc(m.name) + '"' + (compare.indexOf(m.id) >= 0 ? ' checked' : '') + '></td>' +
            '<td><button type="button" class="linkbtn strong" data-pick="' + m.id + '">' + esc(m.name) + '</button>' + (m.detail ? '<span class="sub">' + esc(m.detail) + '</span>' : '') + '</td>' +
            COLS.map(function (c) { return '<td class="n">' + esc(c[2](m)) + '</td>'; }).join('') +
            '<td>' + esc(m.cond) + '</td><td class="st">' + esc(status(m)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }).join('');
  }
  document.getElementById('mat-tables').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.hasAttribute('data-pick')) { choose(b.getAttribute('data-pick'), 'material'); }
    else if (b.hasAttribute('data-col')) {
      var f = b.getAttribute('data-fam'), c = b.getAttribute('data-col'), s = sorts[f];
      sorts[f] = !s || s.col !== c ? { col: c, dir: 1 } : s.dir === 1 ? { col: c, dir: -1 } : null;
      renderTables();
      var again = document.querySelector('.sortbtn[data-fam="' + f + '"][data-col="' + c + '"]');
      if (again) again.focus();
    }
  });
  document.getElementById('mat-tables').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-cmp');
    if (!id) return;
    if (e.target.checked) { compare.push(id); if (compare.length > 2) compare.shift(); }
    else compare = compare.filter(function (c) { return c !== id; });
    renderTables();
    var again = document.querySelector('input[data-cmp="' + id + '"]');
    if (again) again.focus();
  });

  /* ---------- Chart filters (controls) ---------- */
  function toolsHtml() {
    return '<div class="chart-tools" role="group" aria-label="Chart filters">' +
      '<div class="chart-fams" role="group" aria-label="Show these families">' + FAMS.map(function (f) {
        var n = MATS.filter(function (m) { return m.family === f.id; }).length;
        return '<button type="button" class="fam-btn" data-fam="' + f.id + '" aria-pressed="true"><span class="fam-state" aria-hidden="true">✓</span>' + swatch(f) + esc(f.name) + ' <span class="muted">(' + n + ')</span></button>';
      }).join('') + '</div>' +
      '<div class="chart-opts">' +
        '<label><input type="checkbox" id="ct-low"> Hide very approximate materials (' + LOW_COUNT + ')</label>' +
        '<label><input type="checkbox" id="ct-names"> Show names</label>' +
        '<label><input type="checkbox" id="ct-outline" checked> Show family outlines</label>' +
      '</div>' +
      '<div class="chart-find"><label for="ct-q">Find a material</label><input type="search" id="ct-q" autocomplete="off" spellcheck="false" placeholder="for example: steel, skin"> <button type="button" class="btn-secondary" id="ct-reset">Reset filters</button></div>' +
      '<p class="small muted" id="ct-status" role="status"></p>' +
    '</div>';
  }
  function listHtml() {
    return '<details class="chart-list" id="ct-list"><summary>List of the materials shown (<span id="ct-count"></span>)</summary>' +
      '<div class="table-scroll" tabindex="0" role="region" aria-label="Materials shown in the chart"><table class="mt"><caption class="sr-only">Materials shown in the chart, with Young’s modulus and density</caption>' +
      '<thead><tr><th scope="col">Material</th><th scope="col">Family</th><th scope="col">Young’s modulus (GPa)</th><th scope="col">Density (kg/m³)</th></tr></thead><tbody id="ct-rows"></tbody></table></div></details>';
  }
  function visible(m) {
    if (!filt.fams[m.family]) return false;
    if (filt.hideLow && m.low) return false;
    if (filt.q) { var hay = (m.name + ' ' + (m.detail || '')).toLowerCase(); return filt.q.split(' ').every(function (w) { return hay.indexOf(w) >= 0; }); }
    return true;
  }
  function shown() { return MATS.filter(visible); }
  function byDensity(a, b) { return midv(a.rho) - midv(b.rho) || midv(a.E) - midv(b.E); }
  function byModulus(a, b) { return midv(a.E) - midv(b.E) || midv(a.rho) - midv(b.rho); }
  function shortName(n) { return n.length > 26 ? n.slice(0, 25) + '…' : n; }

  /* ---------- Chart tab ---------- */
  var CW = 760, CH = 520, CM = { l: 70, r: 20, t: 24, b: 56 };
  var X0 = Math.log10(50), X1 = Math.log10(20000), Y0 = Math.log10(0.0002), Y1 = Math.log10(3000);
  var LABEL_SIDE = { metals: 'above', composites: 'left', ceramics: 'below', plastics: 'right', wood: 'above', rubbers: 'right', bio: 'left' };
  function cx(v) { return CM.l + (Math.log10(v) - X0) / (X1 - X0) * (CW - CM.l - CM.r); }
  function cy(v) { return CH - CM.b - (Math.log10(v) - Y0) / (Y1 - Y0) * (CH - CM.t - CM.b); }
  var lastNames = { skipped: 0, tooMany: false };

  /* Names next to the markers: each goes in the first free spot (right, left, above, below); a name with no free spot is left out and counted. */
  function nameLabels(vis, pos, taken) {
    var placed = taken.slice(), skipped = 0, out = '';
    var pts = vis.map(function (m) { return { x: pos[m.id].mx, y: pos[m.id].my }; });
    function free(r) {
      if (r.x0 < CM.l || r.x1 > CW - CM.r || r.y0 < CM.t || r.y1 > CH - CM.b) return false;
      var i;
      for (i = 0; i < placed.length; i++) { var q = placed[i]; if (r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0) return false; }
      for (i = 0; i < pts.length; i++) { var t = pts[i]; if (t.x > r.x0 - 4 && t.x < r.x1 + 4 && t.y > r.y0 - 4 && t.y < r.y1 + 4) return false; }
      return true;
    }
    vis.slice().sort(function (a, b) { return (b.id === sel) - (a.id === sel); }).forEach(function (m) {
      var p = pos[m.id], txt = shortName(m.name), wd = txt.length * 6.2;
      var cand = [
        { x: p.mx + p.w / 2 + 5, y: p.my + 4, a: 'start', x0: p.mx + p.w / 2 + 5, x1: p.mx + p.w / 2 + 5 + wd },
        { x: p.mx - p.w / 2 - 5, y: p.my + 4, a: 'end', x0: p.mx - p.w / 2 - 5 - wd, x1: p.mx - p.w / 2 - 5 },
        { x: p.mx, y: p.my - p.h / 2 - 5, a: 'middle', x0: p.mx - wd / 2, x1: p.mx + wd / 2 },
        { x: p.mx, y: p.my + p.h / 2 + 14, a: 'middle', x0: p.mx - wd / 2, x1: p.mx + wd / 2 }
      ], k, c = null;
      for (k = 0; k < cand.length; k++) { cand[k].y0 = cand[k].y - 10; cand[k].y1 = cand[k].y + 3; if (!c && free(cand[k])) c = cand[k]; }
      if (!c) { skipped++; return; }
      placed.push(c);
      out += '<text class="mat-name" x="' + c.x.toFixed(1) + '" y="' + c.y.toFixed(1) + '" text-anchor="' + c.a + '" font-size="11" font-weight="' + (m.id === sel ? 700 : 400) + '" fill="var(--ink)" style="paint-order:stroke;stroke:var(--surface);stroke-width:3px">' + esc(txt) + '</text>';
    });
    return { svg: out, skipped: skipped };
  }

  function drawChart() {
    var vis = shown(), pos = {}, taken = [];
    var s = '<svg viewBox="0 0 ' + CW + ' ' + CH + '" role="group" aria-label="Young’s modulus against density for ' + vis.length + ' of ' + MATS.length + ' materials in the list, grouped by family">';
    s += '<rect x="' + CM.l + '" y="' + CM.t + '" width="' + (CW - CM.l - CM.r) + '" height="' + (CH - CM.t - CM.b) + '" fill="none" stroke="var(--line)"/>';
    [100, 1000, 10000].forEach(function (v) { s += '<line x1="' + cx(v) + '" x2="' + cx(v) + '" y1="' + CM.t + '" y2="' + (CH - CM.b) + '" stroke="var(--line)"/><text x="' + cx(v) + '" y="' + (CH - CM.b + 18) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + v + '</text>'; });
    [0.001, 0.01, 0.1, 1, 10, 100, 1000].forEach(function (v) { s += '<line x1="' + CM.l + '" x2="' + (CW - CM.r) + '" y1="' + cy(v) + '" y2="' + cy(v) + '" stroke="var(--line)"/><text x="' + (CM.l - 8) + '" y="' + (cy(v) + 4) + '" text-anchor="end" font-size="12" fill="var(--muted)">' + v + '</text>'; });
    s += '<text x="' + (CM.l + (CW - CM.l - CM.r) / 2) + '" y="' + (CH - 14) + '" text-anchor="middle" font-size="13" fill="var(--ink)">Density (kg/m³), log scale</text>' +
      '<text transform="translate(18 ' + (CM.t + (CH - CM.t - CM.b) / 2) + ') rotate(-90)" text-anchor="middle" font-size="13" fill="var(--ink)">Young’s modulus (GPa), log scale</text>';
    var ell = '', lab = '';
    if (filt.outlines) FAMS.forEach(function (f) {
      var ms = vis.filter(function (m) { return m.family === f.id; }), xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
      if (ms.length < 2) return;
      ms.forEach(function (m) { var mx = (cx(m.rho[0]) + cx(m.rho[1])) / 2, my = (cy(m.E[0]) + cy(m.E[1])) / 2; xa = Math.min(xa, mx); xb = Math.max(xb, mx); ya = Math.min(ya, my); yb = Math.max(yb, my); });
      var ex = (xa + xb) / 2, ey = (ya + yb) / 2, k = f.id === 'bio' ? 0.8 : 1.0, rx = Math.max((xb - xa) / 2 * k + 28, 36), ry = Math.max((yb - ya) / 2 * k + 20, 24);
      ell += '<ellipse cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" rx="' + rx.toFixed(1) + '" ry="' + ry.toFixed(1) + '" fill="' + f.color + '" fill-opacity=".07" stroke="' + f.color + '" stroke-dasharray="5 4" stroke-width="1.5"/>';
      var side = LABEL_SIDE[f.id] || 'above', lx = ex, ly = ey - ry - 5, anc = 'middle';
      if (side === 'below') ly = ey + ry + 14;
      else if (side === 'right') { lx = ex + rx + 6; ly = ey + 4; anc = 'start'; }
      else if (side === 'left') { lx = ex - rx - 6; ly = ey + 4; anc = 'end'; }
      var fw = f.name.length * 7.6;
      taken.push({ x0: anc === 'start' ? lx : anc === 'end' ? lx - fw : lx - fw / 2, x1: anc === 'start' ? lx + fw : anc === 'end' ? lx : lx + fw / 2, y0: ly - 13, y1: ly + 4 });
      lab += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anc + '" font-size="13" font-weight="700" fill="var(--ink)" style="paint-order:stroke;stroke:var(--surface);stroke-width:3px">' + esc(f.name) + '</text>';
    });
    s += ell;
    var fid = focusId && vis.some(function (m) { return m.id === focusId; }) ? focusId : (vis.some(function (m) { return m.id === sel; }) ? sel : (vis.length ? vis.slice().sort(byDensity)[0].id : null));
    var items = '';
    vis.forEach(function (m) {
      var f = fam(m.family), xa = cx(m.rho[0]), xb = cx(m.rho[1]), ya = cy(m.E[1]), yb = cy(m.E[0]);
      var w = Math.max(xb - xa, 8), h = Math.max(yb - ya, 8), mx = (xa + xb) / 2, my = (ya + yb) / 2, on = m.id === sel;
      pos[m.id] = { mx: mx, my: my, w: w, h: h };
      items += '<g class="mat-pt' + (on ? ' on' : '') + '" data-id="' + m.id + '" tabindex="' + (m.id === fid ? 0 : -1) + '" role="button" aria-label="' + esc(m.name + ', Young’s modulus ' + rng(m.E) + ' GPa, density ' + rng(m.rho) + ' kg per cubic metre' + (on ? ', selected' : '')) + '">' +
        '<rect x="' + (mx - w / 2).toFixed(1) + '" y="' + (my - h / 2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="6" fill="' + f.color + '" fill-opacity="' + (on ? 0.35 : 0.14) + '" stroke="' + f.color + '" stroke-width="' + (on ? 2.5 : 1) + '"/>' +
        shape(f, Math.round(mx * 10) / 10, Math.round(my * 10) / 10, on ? 6.5 : 4.2, 'stroke="var(--surface)" stroke-width="1"') + '</g>';
    });
    s += items + lab;
    lastNames = { skipped: 0, tooMany: false };
    var named = false;
    if (filt.names) {
      if (vis.length > MAX_NAMES) lastNames.tooMany = true;
      else { var nl = nameLabels(vis, pos, taken); s += nl.svg; lastNames.skipped = nl.skipped; named = true; }
    }
    var m0 = BY[sel];
    if (!named && pos[sel]) {
      var mx0 = pos[sel].mx, my0 = pos[sel].my, right = mx0 > CW * 0.6;
      s += '<text x="' + (mx0 + (right ? -12 : 12)).toFixed(1) + '" y="' + (my0 + 26).toFixed(1) + '" text-anchor="' + (right ? 'end' : 'start') + '" font-size="12.5" font-weight="700" fill="var(--ink)" style="paint-order:stroke;stroke:var(--surface);stroke-width:3px">' + esc(m0.name) + '</text>';
    }
    if (!vis.length) s += '<text x="' + (CM.l + (CW - CM.l - CM.r) / 2) + '" y="' + (CM.t + (CH - CM.t - CM.b) / 2) + '" text-anchor="middle" font-size="14" fill="var(--muted)">No materials match the filters.</text>';
    s += '</svg><div class="mat-tip" id="mat-tip" hidden></div>';
    document.getElementById('mat-chart').innerHTML = s;
    var m = BY[sel], f = fam(m.family);
    document.getElementById('mat-side').innerHTML =
      '<h3>' + swatch(f) + esc(m.name) + '</h3><dl class="readout"><dt>Young’s modulus</dt><dd>' + rng(m.E) + ' GPa</dd><dt>Density</dt><dd>' + rng(m.rho) + ' kg/m³</dd><dt>Yield</dt><dd>' + (m.ys ? rng(m.ys) + ' MPa' : 'n/a') + '</dd><dt>Tensile strength</dt><dd>' + rng(m.uts) + ' MPa</dd></dl>' +
      '<p><span class="tag">' + esc(status(m)) + '</span></p>' +
      (visible(m) ? '' : '<p class="muted small">This material is hidden by the current filters.</p>') +
      '<div class="legend">' + FAMS.map(function (g) { return '<span>' + swatch(g) + esc(g.name) + '</span>'; }).join('') + '</div>' +
      '<p class="muted small">These are typical ranges, not measurements. See “Where these values come from” below.</p>';
    renderStatus(vis);
  }
  function renderStatus(vis) {
    var el = document.getElementById('ct-status'), t = 'Showing ' + vis.length + ' of ' + MATS.length + ' materials.';
    if (!visible(BY[sel])) t += ' The selected material, ' + BY[sel].name + ', is hidden by the filters.';
    if (filt.names && lastNames.tooMany) t += ' Names are shown when ' + MAX_NAMES + ' materials or fewer are showing; filter further or use the list.';
    else if (filt.names && lastNames.skipped) t += ' ' + lastNames.skipped + (lastNames.skipped === 1 ? ' name is' : ' names are') + ' left out because they would overlap; they are in the list.';
    if (el.textContent !== t) el.textContent = t;
  }
  function renderList() {
    var vis = shown(), rows = '';
    document.getElementById('ct-count').textContent = vis.length;
    FAMS.forEach(function (f) {
      vis.filter(function (m) { return m.family === f.id; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (m) {
        rows += '<tr' + (m.id === sel ? ' class="sel"' : '') + '><td><button type="button" class="linkbtn strong" data-chart-pick="' + m.id + '"' + (m.id === sel ? ' aria-current="true"' : '') + '>' + esc(m.name) + '</button></td><td>' + esc(f.name) + '</td><td class="n">' + esc(rng(m.E)) + '</td><td class="n">' + esc(rng(m.rho)) + '</td></tr>';
      });
    });
    document.getElementById('ct-rows').innerHTML = rows || '<tr><td colspan="4" class="muted">No materials match the filters.</td></tr>';
  }
  function applyFilters() { drawChart(); renderList(); }

  /* filter controls */
  var famBtns = [].slice.call(box.querySelectorAll('.fam-btn'));
  function syncFilterControls() {
    famBtns.forEach(function (b) { var on = filt.fams[b.getAttribute('data-fam')]; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.querySelector('.fam-state').textContent = on ? '✓' : '–'; });
    document.getElementById('ct-low').checked = filt.hideLow;
    document.getElementById('ct-names').checked = filt.names;
    document.getElementById('ct-outline').checked = filt.outlines;
    document.getElementById('ct-q').value = filt.q;
  }
  famBtns.forEach(function (b) {
    b.addEventListener('click', function () { var id = b.getAttribute('data-fam'); filt.fams[id] = !filt.fams[id]; syncFilterControls(); applyFilters(); });
  });
  document.getElementById('ct-low').addEventListener('change', function (e) { filt.hideLow = e.target.checked; applyFilters(); });
  document.getElementById('ct-names').addEventListener('change', function (e) { filt.names = e.target.checked; applyFilters(); });
  document.getElementById('ct-outline').addEventListener('change', function (e) { filt.outlines = e.target.checked; applyFilters(); });
  var qTimer = null, qBox = document.getElementById('ct-q');
  qBox.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(function () { filt.q = qBox.value.trim().toLowerCase().replace(/\s+/g, ' '); applyFilters(); }, 150); });
  qBox.addEventListener('keydown', function (e) { if (e.key === 'Escape' && qBox.value) { e.preventDefault(); qBox.value = ''; filt.q = ''; applyFilters(); } });
  document.getElementById('ct-reset').addEventListener('click', function () {
    FAMS.forEach(function (f) { filt.fams[f.id] = true; });
    filt.hideLow = false; filt.names = false; filt.outlines = true; filt.q = '';
    syncFilterControls(); applyFilters();
  });
  document.getElementById('ct-list').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-chart-pick]') : null;
    if (!b) return;
    var id = b.getAttribute('data-chart-pick');
    choose(id, 'chart');
    var again = document.querySelector('#ct-rows button[data-chart-pick="' + id + '"]');
    if (again) again.focus();
  });

  /* chart pointer and keyboard */
  var chartEl = document.getElementById('mat-chart');
  function tip(g, e) {
    var t = document.getElementById('mat-tip'), m = BY[g.getAttribute('data-id')], b = chartEl.getBoundingClientRect(), r = g.getBoundingClientRect();
    t.hidden = false;
    t.innerHTML = '<strong>' + esc(m.name) + '</strong><br>E ' + rng(m.E) + ' GPa · ρ ' + rng(m.rho) + ' kg/m³';
    var x = (e && e.clientX ? e.clientX : r.left + r.width / 2) - b.left + 12, y = (e && e.clientY ? e.clientY : r.top) - b.top - 8;
    t.style.left = Math.min(x, b.width - 200) + 'px'; t.style.top = Math.max(y, 0) + 'px';
  }
  function moveFocus(id) {
    var cur = chartEl.querySelector('.mat-pt[tabindex="0"]'), g = chartEl.querySelector('.mat-pt[data-id="' + id + '"]');
    if (!g) return;
    if (cur) cur.tabIndex = -1;
    g.tabIndex = 0; g.focus();
  }
  chartEl.addEventListener('mousemove', function (e) { var g = e.target.closest ? e.target.closest('.mat-pt') : null; if (g) tip(g, e); else document.getElementById('mat-tip').hidden = true; });
  chartEl.addEventListener('mouseleave', function () { document.getElementById('mat-tip').hidden = true; });
  chartEl.addEventListener('focusin', function (e) { var g = e.target.closest ? e.target.closest('.mat-pt') : null; if (g) { focusId = g.getAttribute('data-id'); tip(g); } });
  chartEl.addEventListener('focusout', function () { document.getElementById('mat-tip').hidden = true; });
  chartEl.addEventListener('click', function (e) { var g = e.target.closest ? e.target.closest('.mat-pt') : null; if (g) choose(g.getAttribute('data-id'), 'chart', true); });
  /* The chart is one Tab stop. Arrow keys move between the materials showing (left and right by density, up and down by modulus), Home and End jump to the ends, Enter or Space chooses. */
  chartEl.addEventListener('keydown', function (e) {
    var g = e.target.closest ? e.target.closest('.mat-pt') : null;
    if (!g) return;
    var id = g.getAttribute('data-id');
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(id, 'chart', true); return; }
    var list, i, next = null, vis = shown();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
      list = vis.slice().sort(byDensity);
      i = list.map(function (m) { return m.id; }).indexOf(id);
      next = e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : list[i + (e.key === 'ArrowRight' ? 1 : -1)];
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      list = vis.slice().sort(byModulus);
      i = list.map(function (m) { return m.id; }).indexOf(id);
      next = list[i + (e.key === 'ArrowUp' ? 1 : -1)];
    } else return;
    e.preventDefault();
    if (next) moveFocus(next.id);
  });

  /* ---------- choosing a material ---------- */
  function choose(id, goTab, keepFocus) {
    if (!BY[id]) return;
    sel = id;
    if (keepFocus) focusId = id;
    if (window.MaterialCombobox) window.MaterialCombobox.set(document.getElementById('mat-select'), id);
    else document.getElementById('mat-select').value = id;
    detail(); renderTables(); drawChart(); renderList();
    if (goTab) selectTab(goTab);
    setHash();
    if (keepFocus) { var g = chartEl.querySelector('.mat-pt[data-id="' + id + '"]'); if (g) g.focus(); }
  }
  document.getElementById('mat-select').addEventListener('change', function (e) { choose(e.target.value); });
  window.addEventListener('hashchange', function () {
    var h = parseHash();
    if (h.id && h.id !== sel) choose(h.id);
    if ((h.tab || 'material') !== tab) selectTab(h.tab || 'material');
  });

  document.getElementById('mat-select').value = sel;
  if (window.MaterialCombobox) window.MaterialCombobox.attach(document.getElementById('mat-select'));
  detail(); renderTables(); drawChart(); renderList(); selectTab(tab);
})();
