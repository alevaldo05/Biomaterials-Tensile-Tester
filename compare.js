/* Compare several files (Load Test page, "Compare several files" mode). Reads several CSV files in this
   browser tab, overlays their curves, and tabulates the same Key results as the single-file graph with a
   mean and sample standard deviation. Nothing is uploaded or saved. The numbers come from graph.js
   (TensileGraph.fromCSV and TensileGraph.numbers); no calculation is changed here. */
(function () {
  'use strict';
  var TG = window.TensileGraph;
  var btn = document.getElementById('cmp-btn'), input = document.getElementById('cmp-file');
  var msgEl = document.getElementById('cmp-msg'), app = document.getElementById('compare-app');
  if (!TG || !btn || !input || !msgEl || !app) return;

  var MAX = 12;
  var specs = [], serial = 0;
  /* Okabe-Ito colors (colorblind-safe) plus a different line style per specimen, so color is not the only cue. */
  var COLORS = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#7f7f7f', '#000000'];
  var DASH = ['', '9 4', '2 3', '11 3 2 3'];
  /* result column -> entry in data/terms.js (hover or Tab shows the definition) */
  var TERM_OF = { E: 'modulus', yield: 'yield', uts: 'uts', failStrain: 'failstrain', tough: 'energy', s0: 's0', hs: 'holdstart', send: 'sfinal', relaxed: 'relaxed', E0: 'apparent', tau: 'tau' };
  var COLS = {
    uniaxial: [
      { k: 'E', name: 'Automatic modulus estimate, E', kind: 'stress', csv: 'E_MPa' },
      { k: 'yield', name: 'Yield strength (0.2% offset)', kind: 'stress', csv: 'yield_MPa' },
      { k: 'uts', name: 'Ultimate tensile strength', kind: 'stress', csv: 'UTS_MPa' },
      { k: 'failStrain', name: 'Estimated failure strain (force-drop rule)', kind: 'strain', csv: 'failure_strain' },
      { k: 'tough', name: 'Energy density to recorded endpoint', kind: 'energy', csv: 'toughness_MJ_m3' }
    ],
    relaxation: [
      { k: 's0', name: 'Ramp-peak stress, σ₀', kind: 'stress', csv: 'sigma0_MPa' },
      { k: 'hs', name: 'Hold-start stress', kind: 'stress', csv: 'hold_start_stress_MPa' },
      { k: 'send', name: 'Final recorded stress', kind: 'stress', csv: 'final_stress_MPa' },
      { k: 'relaxed', name: 'Relaxed', kind: 'percent', csv: 'relaxed_pct' },
      { k: 'E0', name: 'Apparent stress/strain ratio after ramp', kind: 'stress', csv: 'E0_MPa' },
      { k: 'tau', name: 'Endpoint-referenced 1/e decay time, τ', kind: 'time', csv: 'tau_s' }
    ]
  };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function sig(v, n) { return v === null || v === undefined || !isFinite(v) ? '—' : String(parseFloat(Number(v).toPrecision(n || 3))); }
  function testType() { return document.querySelector('input[name="load-test"]:checked').value; }
  function isRelax() { return testType() === 'relaxation'; }
  function msg(text, isError) { msgEl.textContent = text; msgEl.className = 'csv-msg' + (isError ? ' error' : ''); }
  function fontStack() { try { return getComputedStyle(document.body).fontFamily.replace(/"/g, "'"); } catch (e) { return 'system-ui,sans-serif'; } }

  /* ---------- reading files ---------- */
  function readFile(file) {
    return new Promise(function (resolve) {
      if (file.size > 20e6) { resolve({ file: file, error: 'larger than 20 MB' }); return; }
      var rd = new FileReader();
      rd.onerror = function () { resolve({ file: file, error: 'could not be read' }); };
      rd.onload = function () {
        try { resolve({ file: file, rec: TG.fromCSV(file.name, String(rd.result), testType()) }); }
        catch (err) { resolve({ file: file, error: err.message }); }
      };
      rd.readAsText(file);
    });
  }
  function uniqueName(base) {
    var name = base, i = 2;
    while (specs.some(function (s) { return s.name === name; })) name = base + ' (' + (i++) + ')';
    return name;
  }
  btn.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () {
    var files = [].slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    var room = MAX - specs.length, skipped = Math.max(0, files.length - room);
    files = files.slice(0, Math.max(0, room));
    if (!files.length) { msg('You already have ' + MAX + ' files. Remove one to add another.', true); return; }
    Promise.all(files.map(readFile)).then(function (results) {
      var added = 0, problems = [];
      results.forEach(function (r) {
        if (r.error) { problems.push(r.file.name + ': ' + String(r.error).replace(/\.$/, '')); return; }
        var base = r.rec.specimenId || r.file.name.replace(/\.[^.]*$/, '');
        specs.push({ id: ++serial, name: uniqueName(base), file: r.file.name, rec: r.rec, nums: TG.numbers(r.rec, isRelax()), include: true });
        added++;
      });
      var text = 'Added ' + added + ' file' + (added === 1 ? '' : 's') + '.';
      if (skipped) text += ' ' + skipped + ' more not added (limit ' + MAX + ').';
      if (problems.length) text += ' Could not open: ' + problems.join('; ') + '.';
      msg(text, problems.length > 0 && added === 0);
      render();
    });
  });
  /* A different test type cannot be mixed with the files already added. */
  document.querySelectorAll('input[name="load-test"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (!specs.length) return;
      specs = [];
      msg('Test type changed, so the file list was cleared. Choose the files again.');
      render();
    });
  });

  /* ---------- statistics ---------- */
  function included() { return specs.filter(function (s) { return s.include; }); }
  function column(col) {
    return included().map(function (s) { return s.nums[col.k]; }).filter(function (v) { return v !== null && v !== undefined && isFinite(v); });
  }
  function stats(vals) {
    var n = vals.length;
    if (!n) return { n: 0, mean: null, sd: null };
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / n, sd = null;
    if (n > 1) {
      sd = Math.sqrt(vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (n - 1));
      /* Identical values can leave rounding noise (for example 8.9e-14) instead of exactly 0; treat spread below one trillionth of the data's size as 0. */
      var size = Math.max.apply(null, vals.map(Math.abs));
      if (sd <= 1e-12 * size) sd = 0;
    }
    return { n: n, mean: mean, sd: sd };
  }
  /* stress columns are shown in GPa when the values are large (as on the single-file results) */
  function scaleFor(col) {
    if (col.kind !== 'stress') return { div: 1, unit: col.kind === 'strain' ? '–' : col.kind === 'energy' ? 'MJ/m³' : col.kind === 'percent' ? '%' : 's' };
    var big = Math.max.apply(null, column(col).map(Math.abs).concat([0]));
    return big >= 1000 ? { div: 1000, unit: 'GPa' } : { div: 1, unit: 'MPa' };
  }
  function cellText(v, sc) { return v === null || v === undefined || !isFinite(v) ? '—' : sig(v / sc.div, 3); }

  /* ---------- warnings ---------- */
  function warnings() {
    var inc = included(), w = [];
    if (!inc.length) return w;
    var sim = inc.filter(function (s) { return s.rec.simulated; }).length;
    if (sim === inc.length) w.push('All of these files are simulated, not measured.');
    else if (sim) w.push('This mixes simulated files (' + sim + ') with files that are not marked as simulated. Do not average them together.');
    var mats = {};
    inc.forEach(function (s) { if (s.rec.materialText) mats[s.rec.materialText.toLowerCase()] = s.rec.materialText; });
    var mnames = Object.keys(mats).map(function (k) { return mats[k]; });
    if (mnames.length > 1) w.push('These files are from different materials (' + mnames.join(', ') + '). A mean across different materials is rarely meaningful.');
    var exFile = inc.filter(function (s) { return s.rec.dimSource === 'file-example'; }).map(function (s) { return s.name; });
    if (exFile.length) w.push(exFile.join(', ') + (exFile.length === 1 ? ' declares' : ' declare') + ' example dimensions in the file, so stress, strain, and the results are not for a measured specimen.');
    var nodims = inc.filter(function (s) { return !s.rec.direct && !s.rec.dimsFromFile; }).map(function (s) { return s.name; });
    if (nodims.length) w.push(nodims.join(', ') + (nodims.length === 1 ? ' has' : ' have') + ' no saved dimensions, so example dimensions were used. Example dimensions are not measurements, and stress, strain, and the results may be wrong for your specimens.');
    if (inc.length < 2) w.push('The mean and standard deviation need at least 2 specimens.');
    return w;
  }
  function sourceNote() {
    var inc = included(), sim = inc.filter(function (s) { return s.rec.simulated; }).length;
    return !inc.length ? '' : sim === inc.length ? 'Simulated data, not measured' : sim ? 'Includes simulated data, not measured' : 'Loaded files (data origin not verified)';
  }

  /* ---------- the overlay graph ---------- */
  function niceTicks(lo, hi, n) {
    var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p, t = [];
    for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) t.push(parseFloat(v.toPrecision(12)));
    return { ticks: t, step: step };
  }
  function lineColor(i, exp) { return COLORS[i % COLORS.length] === '#000000' && !exp ? 'var(--ink)' : COLORS[i % COLORS.length]; }
  function buildSvg(exp) {
    var inc = included(), cfg = TG.configs[testType()];
    var W = 760, H = 440, M = { l: 74, r: 24, t: 50, b: 60 }, pw = W - M.l - M.r, ph = H - M.t - M.b;
    var pal = exp ? { text: '#1f2a24', muted: '#4a5a50', grid: '#d9ddd3', axis: '#4a5a50', bg: '#ffffff' } : { text: 'var(--ink)', muted: 'var(--muted)', grid: 'var(--line)', axis: 'var(--muted)', bg: null };
    var xmax = 0, ymax = 0;
    inc.forEach(function (s) { s.rec.x.forEach(function (v) { if (v > xmax) xmax = v; }); s.rec.y.forEach(function (v) { if (v > ymax) ymax = v; }); });
    if (!(xmax > 0)) xmax = 1;
    if (!(ymax > 0)) ymax = 1;
    var xt = niceTicks(0, xmax, 8), yt = niceTicks(0, ymax * 1.04, 5);
    var xTop = Math.ceil(xmax / xt.step - 1e-9) * xt.step, yTop = Math.ceil(ymax * 1.04 / yt.step) * yt.step;
    function sx(v) { return M.l + v / xTop * pw; }
    function sy(v) { return M.t + ph - v / yTop * ph; }
    var title = cfg.name + ' – comparison of ' + inc.length + ' specimen' + (inc.length === 1 ? '' : 's');
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (exp ? ' width="' + W * 1.667 + '" height="' + H * 1.667 + '"' : ' role="img" aria-label="' + esc(title) + '"') + ' font-family="' + fontStack() + '">';
    if (pal.bg) s += '<rect width="' + W + '" height="' + H + '" fill="' + pal.bg + '"/>';
    s += '<text x="' + M.l + '" y="28" style="fill:' + pal.text + ';font-size:17px;font-weight:600">' + esc(title) + '</text>';
    yt.ticks.forEach(function (v) { s += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + sy(v) + '" y2="' + sy(v) + '" style="stroke:' + pal.grid + '"/>'; });
    xt.ticks.forEach(function (v) { if (v > 0) s += '<line x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.grid + '"/>'; });
    s += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + (H - M.b) + '" y2="' + (H - M.b) + '" style="stroke:' + pal.axis + ';stroke-width:1.5"/><line x1="' + M.l + '" x2="' + M.l + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.axis + ';stroke-width:1.5"/>';
    yt.ticks.forEach(function (v) { s += '<text x="' + (M.l - 9) + '" y="' + (sy(v) + 4) + '" text-anchor="end" style="fill:' + pal.muted + ';font-size:12px">' + sig(v, 6) + '</text>'; });
    xt.ticks.forEach(function (v) { s += '<text x="' + sx(v) + '" y="' + (H - M.b + 20) + '" text-anchor="middle" style="fill:' + pal.muted + ';font-size:12px">' + sig(v, 6) + '</text>'; });
    s += '<text x="' + (M.l + pw / 2) + '" y="' + (H - 16) + '" text-anchor="middle" style="fill:' + pal.text + ';font-size:13px">' + esc(cfg.xLabel) + '</text>';
    s += '<text transform="translate(18 ' + (M.t + ph / 2) + ') rotate(-90)" text-anchor="middle" style="fill:' + pal.text + ';font-size:13px">' + esc(cfg.yLabel) + '</text>';
    s += '<defs><clipPath id="cmp-clip"><rect x="' + M.l + '" y="' + (M.t - 6) + '" width="' + (pw + 6) + '" height="' + (ph + 6) + '"/></clipPath></defs>';
    specs.forEach(function (sp, idx) {
      if (!sp.include) return;
      var X = sp.rec.x, Y = sp.rec.y, n = X.length, stride = Math.max(1, Math.ceil(n / 1500)), d = '';
      for (var i = 0; i < n; i += stride) d += (d ? 'L' : 'M') + sx(X[i]).toFixed(1) + ' ' + sy(Y[i]).toFixed(1);
      if ((n - 1) % stride) d += 'L' + sx(X[n - 1]).toFixed(1) + ' ' + sy(Y[n - 1]).toFixed(1);
      var dash = DASH[idx % DASH.length];
      s += '<path d="' + d + '" fill="none" clip-path="url(#cmp-clip)" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' style="stroke:' + lineColor(idx, exp) + ';stroke-width:2.25"/>';
    });
    var note = sourceNote();
    if (note) s += '<text x="' + (W - M.r) + '" y="' + (H - 16) + '" text-anchor="end" style="fill:' + pal.muted + ';font-size:11px;font-style:italic">' + esc(note) + '</text>';
    return s + '</svg>';
  }

  /* ---------- page ---------- */
  function render() {
    if (!specs.length) { app.innerHTML = ''; return; }
    var cols = COLS[testType()], inc = included(), w = warnings();
    var html = '<section class="cmp-card"><h2>Files</h2><ul class="cmp-list">' + specs.map(function (sp, idx) {
      return '<li class="' + (sp.include ? '' : 'is-off') + '"><label><input type="checkbox" data-inc="' + sp.id + '"' + (sp.include ? ' checked' : '') + '> ' +
        '<svg width="34" height="12" aria-hidden="true" class="cmp-sw"><line x1="0" y1="6" x2="34" y2="6" stroke-width="3"' + (DASH[idx % DASH.length] ? ' stroke-dasharray="' + DASH[idx % DASH.length] + '"' : '') + ' style="stroke:' + lineColor(idx) + '"/></svg> ' +
        '<strong>' + esc(sp.name) + '</strong></label> <span class="muted small">' + esc(sp.file) + ' · ' + sp.rec.x.length + ' points · ' + (sp.rec.simulated ? 'Simulated data, not measured' : 'Loaded data') + (sp.rec.materialText ? ' · ' + esc(sp.rec.materialText) : '') + '</span> ' +
        '<button type="button" class="linkbtn" data-rm="' + sp.id + '" aria-label="Remove ' + esc(sp.name) + '">Remove</button></li>';
    }).join('') + '</ul><p class="graph-actions"><button type="button" class="btn-secondary" id="cmp-clear">Remove all files</button></p></section>';
    html += '<div id="cmp-warn">' + w.map(function (t) { return '<p class="cmp-warn" role="status">' + esc(t) + '</p>'; }).join('') + '</div>';
    if (!inc.length) { app.innerHTML = html + '<p class="muted">No files are included. Tick a file above to include it.</p>'; return; }
    html += '<section class="cmp-card"><h2>Overlay</h2><div class="cmp-chart" id="cmp-chart">' + buildSvg(false) + '</div>' +
      '<p class="graph-actions"><button type="button" class="btn-secondary" id="cmp-png">Download PNG</button><button type="button" class="btn-secondary" id="cmp-svg">Download SVG</button></p></section>';
    var sc = {};
    cols.forEach(function (c) { sc[c.k] = scaleFor(c); });
    html += '<section class="cmp-card"><h2>Key results</h2><div class="table-scroll" tabindex="0" role="region" aria-label="Key results by specimen"><table class="mt cmp-table"><caption class="sr-only">Key results for each specimen, with mean and standard deviation</caption><thead><tr><th scope="col">Specimen</th>' +
      cols.map(function (c) { return '<th scope="col"><span' + (TERM_OF[c.k] ? ' data-term="' + TERM_OF[c.k] + '" tabindex="0"' : '') + '>' + esc(c.name) + '</span> <span class="unit">(' + sc[c.k].unit + ')</span></th>'; }).join('') + '</tr></thead><tbody>' +
      inc.map(function (sp) { return '<tr><th scope="row">' + esc(sp.name) + '</th>' + cols.map(function (c) { return '<td class="n">' + cellText(sp.nums[c.k], sc[c.k]) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody><tfoot>' + ['mean', 'sd', 'n'].map(function (kind) {
        return '<tr><th scope="row">' + (kind === 'mean' ? 'Mean' : kind === 'sd' ? '<span data-term="sd" tabindex="0">Standard deviation</span>' : 'n (values used)') + '</th>' + cols.map(function (c) {
          var st = stats(column(c));
          return '<td class="n">' + (kind === 'n' ? st.n : cellText(st[kind], sc[c.k])) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tfoot></table></div>' +
      '<p class="muted small">Same calculations as the single-file graph. The standard deviation is the sample standard deviation (n − 1) and needs at least 2 values. A blank (—) means that result is not reported for that specimen, for example the 0.2% offset yield for soft tissue, or the failure strain when no force drop below 50% of the peak was found in that record.</p>' +
      '<p class="graph-actions"><button type="button" class="btn" id="cmp-csv">Download summary (CSV)</button><button type="button" class="btn-secondary" id="cmp-copy">Copy summary</button>' +
      (window.TensileExcel && window.TensileExcel.buildCompare ? '<button type="button" class="btn-secondary" id="cmp-xlsx">Download comparison (.xlsx)</button>' : '') + '<span class="copy-msg" id="cmp-copy-msg" role="status"></span>' +
      (window.TensileReport ? '<button type="button" class="btn-secondary" id="cmp-print">Print summary report</button>' : '') + '</p></section>';
    app.innerHTML = html;
  }

  /* ---------- events ---------- */
  app.addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-inc');
    if (!id) return;
    specs.forEach(function (s) { if (String(s.id) === id) s.include = e.target.checked; });
    render();
    var again = app.querySelector('input[data-inc="' + id + '"]');
    if (again) again.focus();
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b) return;
    if (b.hasAttribute('data-rm')) {
      var id = b.getAttribute('data-rm');
      specs = specs.filter(function (s) { return String(s.id) !== id; });
      msg(specs.length ? 'Removed a file.' : 'All files removed.');
      render();
      if (!specs.length) btn.focus();
    } else if (b.id === 'cmp-clear') { specs = []; msg('All files removed.'); render(); btn.focus(); }
    else if (b.id === 'cmp-svg') save(new Blob([buildSvg(true)], { type: 'image/svg+xml;charset=utf-8' }), 'comparison.svg');
    else if (b.id === 'cmp-png') png();
    else if (b.id === 'cmp-csv') csv();
    else if (b.id === 'cmp-xlsx') xlsx();
    else if (b.id === 'cmp-copy') copySummary();
    else if (b.id === 'cmp-print') printReport();
  });
  function save(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function png() {
    var url = URL.createObjectURL(new Blob([buildSvg(true)], { type: 'image/svg+xml;charset=utf-8' })), img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = 760 * 3.333; c.height = 440 * 3.333;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { if (b) save(b, 'comparison.png'); }, 'image/png');
    };
    img.src = url;
  }

  /* ---------- printable summary report (report.js) ---------- */
  function printReport() {
    var P = window.TensileReport && window.TensileReport.parts;
    if (!P) return;
    var cols = COLS[testType()], inc = included(), w = warnings(), sc = {};
    cols.forEach(function (c) { sc[c.k] = scaleFor(c); });
    var html = '<article class="report rp-compare">' + P.head('Comparison report', sourceNote() || 'Loaded files (data origin not verified)') +
      '<h2>' + esc(TG.configs[testType()].name) + ': ' + inc.length + ' specimen' + (inc.length === 1 ? '' : 's') + '</h2>' +
      '<table class="rp-table"><thead><tr><th>Specimen</th><th>File</th><th>Material (from file)</th><th>Source</th><th>Points</th><th>Dimensions</th></tr></thead><tbody>' +
      inc.map(function (sp) {
        return '<tr><th scope="row">' + esc(sp.name) + '</th><td>' + esc(sp.file) + '</td><td>' + esc(sp.rec.materialText || '—') + '</td><td>' + (sp.rec.simulated ? 'Simulated data, not measured' : 'Loaded data') + '</td><td>' + sp.rec.x.length + '</td><td>' +
          (TG.dimSourceText(sp.rec) || (sp.rec.direct ? 'not needed (stress and strain given)' : sp.rec.dimsFromFile ? 'read from the file' : 'example values assumed (not measured)')) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      w.map(function (t) { return '<p class="rp-warn">' + esc(t) + '</p>'; }).join('') +
      '<figure class="rp-graph">' + P.fit(buildSvg(true)) + '</figure>' +
      '<h2>Key results <span class="rp-tag">calculated</span></h2>' +
      '<table class="rp-table"><thead><tr><th>Specimen</th>' + cols.map(function (c) { return '<th>' + esc(c.name) + ' (' + sc[c.k].unit + ')</th>'; }).join('') + '</tr></thead><tbody>' +
      inc.map(function (sp) { return '<tr><th scope="row">' + esc(sp.name) + '</th>' + cols.map(function (c) { return '<td class="n">' + cellText(sp.nums[c.k], sc[c.k]) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody><tfoot>' + ['mean', 'sd', 'n'].map(function (kind) {
        return '<tr><th scope="row">' + (kind === 'mean' ? 'Mean' : kind === 'sd' ? 'Standard deviation' : 'n (values used)') + '</th>' + cols.map(function (c) {
          var st = stats(column(c));
          return '<td class="n"><strong>' + (kind === 'n' ? st.n : cellText(st[kind], sc[c.k])) + '</strong></td>';
        }).join('') + '</tr>';
      }).join('') + '</tfoot></table>' +
      '<p class="rp-note">The standard deviation is the sample standard deviation (n − 1) and needs at least 2 values. A dash (—) means that result is not reported for that specimen (for example, no force drop was found, so no failure strain).</p>' +
      '<h2>How the values were obtained</h2><p class="rp-method">' + esc(P.method) + '</p>' + P.foot() + '</article>';
    window.TensileReport.printHtml(html);
  }

  /* ---------- summary CSV (base units: MPa, s, %, MJ/m3) ---------- */
  function cell(v) {
    var s = v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
    if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) s = "'" + s;
    if (/[",;\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function n7(v) { return v === null || v === undefined || !isFinite(v) ? '' : String(parseFloat(Number(v).toPrecision(7))); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea'), ok = false;
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta); done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }
  /* Copy summary: the key-results table as shown on the page (display units), tab-separated, with the data source and any warnings first. */
  function copySummary() {
    var t = app.querySelector('.cmp-table'); if (!t) return;
    function row(tr) { return [].slice.call(tr.children).map(function (c) { return c.textContent.replace(/\s+/g, ' ').trim(); }).join('\t'); }
    var lines = [sourceNote() || 'Loaded files (data origin not verified)'];
    [].slice.call(app.querySelectorAll('#cmp-warn p')).forEach(function (p) { lines.push(p.textContent.replace(/\s+/g, ' ').trim()); });
    lines.push('', 'Specimen\t' + row(t.tHead.rows[0]).split('\t').slice(1).join('\t'));
    [].slice.call(t.tBodies[0].rows).concat([].slice.call(t.tFoot.rows)).forEach(function (tr) { lines.push(row(tr)); });
    copyText(lines.join('\n') + '\n', function (ok) {
      var m = document.getElementById('cmp-copy-msg'); if (!m) return;
      m.textContent = ok ? 'Copied' : 'Could not copy';
      setTimeout(function () { m.textContent = ''; }, 2500);
    });
  }

  function csv() {
    var cols = COLS[testType()], inc = included(), d = new Date();
    var stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    var out = [
      ['Biomaterials Tensile Tester', 'comparison summary'],
      ['Test', TG.configs[testType()].name],
      ['Source', sourceNote() || 'Loaded files (data origin not verified)'],
      ['Date', stamp],
      ['Specimens', inc.length],
      ['Standard deviation', 'sample standard deviation (n - 1)'],
      ['Note', 'computed in this browser from the files you opened; nothing was uploaded']
    ].map(function (m) { return '# ' + m[0] + ',' + cell(m[1]); });
    out.push(['specimen', 'file', 'source', 'material'].concat(cols.map(function (c) { return c.csv; })).join(','));
    inc.forEach(function (sp) {
      out.push([cell(sp.name), cell(sp.file), sp.rec.simulated ? 'simulated (not measured)' : 'loaded', cell(sp.rec.materialText)].concat(cols.map(function (c) { return n7(sp.nums[c.k]); })).join(','));
    });
    ['mean', 'sd', 'n'].forEach(function (kind) {
      out.push([kind === 'mean' ? 'Mean' : kind === 'sd' ? 'Standard deviation' : 'n', '', '', ''].concat(cols.map(function (c) { var st = stats(column(c)); return n7(st[kind]); })).join(','));
    });
    save(new Blob(['﻿' + out.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), 'comparison_' + testType() + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.csv');
  }

  function xlsx() {
    var cols = COLS[testType()], inc = included(), d = new Date();
    var stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    function nv(v) { return v === null || v === undefined || !isFinite(v) ? '' : parseFloat(Number(v).toPrecision(7)); }
    var rows = inc.map(function (sp) {
      return [sp.name, sp.file, sp.rec.simulated ? 'simulated (not measured)' : 'loaded', sp.rec.materialText || ''].concat(cols.map(function (c) { return nv(sp.nums[c.k]); }));
    });
    ['mean', 'sd', 'n'].forEach(function (kind) {
      rows.push([kind === 'mean' ? 'Mean' : kind === 'sd' ? 'Standard deviation' : 'n', '', '', ''].concat(cols.map(function (c) { return nv(stats(column(c))[kind]); })));
    });
    save(window.TensileExcel.buildCompare({
      details: [['Test', TG.configs[testType()].name], ['Source', sourceNote() || 'Loaded files (data origin not verified)'], ['Date', stamp], ['Specimens', inc.length],
        ['Standard deviation', 'sample standard deviation (n - 1)'], ['Values', 'base units (see column names)'], ['Note', 'computed in this browser from the files you opened; nothing was uploaded']],
      header: ['specimen', 'file', 'source', 'material'].concat(cols.map(function (c) { return c.csv; })),
      rows: rows
    }), 'comparison_' + testType() + '_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.xlsx');
  }

  window.addEventListener('beforeunload', function () { /* nothing is kept; files are only in this tab */ });
})();
