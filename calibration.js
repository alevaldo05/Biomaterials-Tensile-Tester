/* Calibration page: compares force readings with known forces and records the result.
   You type known masses and the readings the tester reported. The page calculates the force from each
   mass (F = m g), fits reading = gain * force + offset by least squares, shows the errors and a chart,
   and downloads a CSV record. It does NOT change any reading anywhere, makes no claim of traceability,
   and saves nothing: entries stay in this browser tab until you download the record. */
(function () {
  'use strict';
  var app = document.getElementById('cal-app');
  var resEl = document.getElementById('cal-results');
  if (!app || !resEl) return;

  var G0 = 9.80665; /* standard gravity, m/s2 */
  var MAX_ROWS = 30;
  var rows = [{ m: '', r: '' }, { m: '', r: '' }, { m: '', r: '' }, { m: '', r: '' }, { m: '', r: '' }];
  var example = false, dirty = false;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function num(v) {
    var x = parseFloat(String(v).replace(',', '.'));
    return isFinite(x) ? x : null;
  }
  function sig(v, n) { return v === null || v === undefined || !isFinite(v) ? '—' : String(parseFloat(Number(v).toPrecision(n || 4))); }

  /* ---------- the numbers ---------- */
  function settings() {
    var g = num(document.getElementById('c-g').value);
    return {
      unit: document.getElementById('c-unit').value,
      g: g !== null && g > 0 ? g : null,
      tol: num(document.getElementById('c-tol').value),
      cell: document.getElementById('c-cell').value.trim(),
      notes: document.getElementById('c-notes').value.trim()
    };
  }
  function points(s) {
    var k = s.unit === 'kg' ? 1 : 0.001, out = [];
    rows.forEach(function (row, i) {
      var m = num(row.m), r = num(row.r);
      var F = m !== null && m >= 0 && s.g !== null ? m * k * s.g : null;
      var err = F !== null && r !== null ? r - F : null;
      var pct = err !== null && r !== null && r !== 0 ? err / r * 100 : null;
      out.push({ i: i, m: m, r: r, F: F, err: err, pct: pct, out: err !== null && s.tol !== null && s.tol >= 0 && pct !== null && Math.abs(pct) > s.tol });
    });
    return out;
  }
  /* Least squares: reading = gain * force + offset, over rows that have both a force and a reading. */
  function fit(pts) {
    var p = pts.filter(function (q) { return q.F !== null && q.r !== null; }), n = p.length;
    var res = { n: n, ok: false, msg: '' };
    if (n < 2) { res.msg = 'Enter at least 2 points (a mass and its reading) to fit a line.'; return res; }
    var mf = 0, mr = 0, i;
    for (i = 0; i < n; i++) { mf += p[i].F; mr += p[i].r; }
    mf /= n; mr /= n;
    var sff = 0, sfr = 0, srr = 0;
    for (i = 0; i < n; i++) { sff += (p[i].F - mf) * (p[i].F - mf); sfr += (p[i].F - mf) * (p[i].r - mr); srr += (p[i].r - mr) * (p[i].r - mr); }
    if (!(sff > 0)) { res.msg = 'The masses are all the same, so no line can be fitted. Use at least 2 different masses.'; return res; }
    var a = sfr / sff, b = mr - a * mf, ssres = 0;
    for (i = 0; i < n; i++) { var d = p[i].r - (a * p[i].F + b); ssres += d * d; }
    res.ok = true; res.a = a; res.b = b; res.r2 = srr > 0 ? 1 - ssres / srr : null;
    var big = null;
    pts.forEach(function (q) { if (q.err !== null && (big === null || Math.abs(q.err) > Math.abs(big))) big = q.err; });
    res.big = big;
    res.corr = Math.abs(a) > 1e-12;
    return res;
  }

  /* ---------- page ---------- */
  app.innerHTML =
    '<div class="cal-settings">' +
      '<label class="pf"><span>Mass unit</span><select id="c-unit"><option value="g">grams (g)</option><option value="kg">kilograms (kg)</option></select></label>' +
      '<label class="pf"><span>Gravity, g (m/s²)</span><input id="c-g" type="number" min="0" step="any" inputmode="decimal" value="' + G0 + '"></label>' +
      '<label class="pf"><span>Tolerance, ± % of reading (optional)</span><input id="c-tol" type="number" min="0" step="any" inputmode="decimal" placeholder="blank = no flagging"></label>' +
      '<label class="pf"><span>Load cell ID or name (optional)</span><input id="c-cell" type="text" autocomplete="off"></label>' +
      '<label class="pf cal-notes"><span>Notes (optional)</span><textarea id="c-notes" rows="2"></textarea></label>' +
    '</div>' +
    '<p class="cal-example" id="cal-example" role="status" hidden><strong>Example numbers, not measured.</strong> Replace them with your own readings, or press Clear all.</p>' +
    '<div class="table-scroll" tabindex="0" role="region" aria-label="Calibration points">' +
      '<table class="cal-table"><caption class="sr-only">Known masses and tester readings</caption><thead><tr>' +
        '<th scope="col">#</th><th scope="col" id="th-m">Known mass (g)</th><th scope="col"><span data-term="forcemass" tabindex="0">Force from the mass (N)</span></th><th scope="col">Tester reading (N)</th><th scope="col"><span data-term="errN" tabindex="0">Error (N)</span></th><th scope="col"><span data-term="errPct" tabindex="0">Error (% of reading)</span></th><th scope="col">Flag</th>' +
      '</tr></thead><tbody id="cal-rows"></tbody></table>' +
    '</div>' +
    '<p class="muted small">Error = reading − force from the mass. Error (% of reading) = error ÷ reading × 100. A flag appears only if you enter a tolerance above. Percentages are large and not very meaningful when the reading is close to zero.</p>' +
    '<div class="graph-actions">' +
      '<button type="button" class="btn-secondary" id="c-add">Add row</button>' +
      '<button type="button" class="btn-secondary" id="c-remove">Remove last row</button>' +
      '<button type="button" class="btn-secondary" id="c-example">Fill example values</button>' +
      '<button type="button" class="btn-secondary" id="c-clear">Clear all</button>' +
    '</div>';

  function renderRows() {
    document.getElementById('cal-rows').innerHTML = rows.map(function (row, i) {
      return '<tr data-i="' + i + '"><th scope="row">' + (i + 1) + '</th>' +
        '<td><input type="number" min="0" step="any" inputmode="decimal" data-f="m" aria-label="Known mass, row ' + (i + 1) + '" value="' + esc(row.m) + '"></td>' +
        '<td class="n" data-c="F">—</td>' +
        '<td><input type="number" step="any" inputmode="decimal" data-f="r" aria-label="Tester reading in newtons, row ' + (i + 1) + '" value="' + esc(row.r) + '"></td>' +
        '<td class="n" data-c="err">—</td><td class="n" data-c="pct">—</td><td data-c="flag"></td></tr>';
    }).join('');
    document.getElementById('c-remove').disabled = rows.length <= 1;
    document.getElementById('c-add').disabled = rows.length >= MAX_ROWS;
  }

  /* ---------- results and chart ---------- */
  function niceStep(span, n) {
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function chart(pts, f) {
    var p = pts.filter(function (q) { return q.F !== null && q.r !== null; });
    if (p.length < 2) return '';
    var W = 640, H = 400, M = { l: 70, r: 20, t: 20, b: 52 };
    var lo = 0, hi = 0;
    p.forEach(function (q) { hi = Math.max(hi, q.F, q.r); lo = Math.min(lo, q.F, q.r); });
    if (!(hi > lo)) hi = lo + 1;
    var step = niceStep(hi - lo, 5), top = Math.ceil(hi / step - 1e-9) * step, bot = Math.floor(lo / step + 1e-9) * step;
    function sx(v) { return M.l + (v - bot) / (top - bot) * (W - M.l - M.r); }
    function sy(v) { return H - M.b - (v - bot) / (top - bot) * (H - M.t - M.b); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tester reading against force from the mass, with the fitted line and the ideal one-to-one line">';
    s += '<rect x="' + M.l + '" y="' + M.t + '" width="' + (W - M.l - M.r) + '" height="' + (H - M.t - M.b) + '" fill="none" stroke="var(--line)"/>';
    for (var v = bot; v <= top + step * 1e-6; v += step) {
      var t = parseFloat(v.toPrecision(10));
      s += '<line x1="' + sx(t) + '" x2="' + sx(t) + '" y1="' + M.t + '" y2="' + (H - M.b) + '" stroke="var(--line)"/><text x="' + sx(t) + '" y="' + (H - M.b + 18) + '" text-anchor="middle" font-size="12" fill="var(--muted)">' + sig(t, 5) + '</text>';
      s += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + sy(t) + '" y2="' + sy(t) + '" stroke="var(--line)"/><text x="' + (M.l - 8) + '" y="' + (sy(t) + 4) + '" text-anchor="end" font-size="12" fill="var(--muted)">' + sig(t, 5) + '</text>';
    }
    s += '<text x="' + (M.l + (W - M.l - M.r) / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="13" fill="var(--ink)">Force from the mass (N)</text>' +
      '<text transform="translate(16 ' + (M.t + (H - M.t - M.b) / 2) + ') rotate(-90)" text-anchor="middle" font-size="13" fill="var(--ink)">Tester reading (N)</text>';
    s += '<line x1="' + sx(bot) + '" y1="' + sy(bot) + '" x2="' + sx(top) + '" y2="' + sy(top) + '" stroke="var(--muted)" stroke-width="1.75" stroke-dasharray="6 4"/>';
    if (f.ok) s += '<line x1="' + sx(bot) + '" y1="' + sy(f.a * bot + f.b) + '" x2="' + sx(top) + '" y2="' + sy(f.a * top + f.b) + '" stroke="var(--accent)" stroke-width="2.5"/>';
    p.forEach(function (q) { s += '<circle cx="' + sx(q.F) + '" cy="' + sy(q.r) + '" r="5" fill="var(--surface)" stroke="var(' + (q.out ? '--danger' : '--ink') + ')" stroke-width="2.5"/>'; });
    s += '</svg><p class="legend"><span><svg width="26" height="10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 4"/></svg> Ideal: reading = force</span><span><svg width="26" height="10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke="var(--accent)" stroke-width="3"/></svg> Fitted line</span><span><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--ink)" stroke-width="2.5"/></svg> Your points</span></p>';
    return s;
  }

  function update() {
    var s = settings(), pts = points(s), f = fit(pts);
    document.getElementById('th-m').textContent = 'Known mass (' + s.unit + ')';
    var tbody = document.getElementById('cal-rows');
    pts.forEach(function (q) {
      var tr = tbody.querySelector('tr[data-i="' + q.i + '"]');
      if (!tr) return;
      tr.querySelector('[data-c="F"]').textContent = sig(q.F, 5);
      tr.querySelector('[data-c="err"]').textContent = sig(q.err, 4);
      tr.querySelector('[data-c="pct"]').textContent = q.pct === null ? '—' : sig(q.pct, 3) + ' %';
      tr.querySelector('[data-c="flag"]').innerHTML = q.out ? '<span class="cal-flag">Outside ±' + esc(sig(s.tol, 4)) + ' %</span>' : '';
      tr.classList.toggle('is-out', q.out);
    });
    document.getElementById('cal-example').hidden = !example;
    var warn = s.g === null ? '<p class="cal-warn" role="alert">Enter a gravity value greater than 0.</p>' : '';
    var html = warn;
    if (f.ok) {
      html += '<dl class="mat-dl cal-dl">' +
        '<dt data-term="gain" tabindex="0">Gain (reading per newton of force)</dt><dd>' + sig(f.a, 6) + '</dd>' +
        '<dt data-term="offset" tabindex="0">Zero offset (N)</dt><dd>' + sig(f.b, 4) + '</dd>' +
        '<dt>R²</dt><dd>' + (f.r2 === null ? '—' : sig(f.r2, 6)) + '</dd>' +
        '<dt>Points used</dt><dd>' + f.n + (f.n < 5 ? ' <span class="muted small">(5 or more is better)</span>' : '') + '</dd>' +
        '<dt>Largest error (N)</dt><dd>' + sig(f.big, 4) + '</dd></dl>' +
        (f.corr ? '<p><strong>Suggested correction (not applied by this site):</strong> corrected force = (reading − ' + sig(f.b, 4) + ') ÷ ' + sig(f.a, 6) + '</p>' : '<p class="cal-warn">The fitted gain is zero, so no correction can be suggested.</p>') +
        '<p class="muted small">Fit: reading = gain × force + offset, by least squares over the rows that have both a mass and a reading. R² near 1 means the points lie close to a straight line; it says nothing about whether the masses were accurate.</p>';
    } else html += '<p class="muted">' + esc(f.msg) + '</p>';
    html += '<p class="graph-actions"><button type="button" class="btn" id="c-dl"' + (f.n >= 1 ? '' : ' disabled') + '>Download calibration record (CSV)</button>' +
      '<button type="button" class="btn-secondary" id="c-print"' + (f.n >= 1 && window.TensileReport ? '' : ' disabled') + '>Print report</button>' +
      '<button type="button" class="btn-secondary" id="c-copy"' + (f.n >= 1 ? '' : ' disabled') + '>Copy results</button><span class="copy-msg" id="c-copy-msg" role="status"></span></p>';
    html += chart(pts, f);
    resEl.innerHTML = html;
    var dl = document.getElementById('c-dl');
    if (dl) dl.addEventListener('click', function () { download(s, pts, f); });
    var pr = document.getElementById('c-print');
    if (pr) pr.addEventListener('click', function () { printReport(s, pts, f); });
    var cp = document.getElementById('c-copy');
    if (cp) cp.addEventListener('click', function () { copyResults(s, pts, f, document.getElementById('c-copy-msg')); });
  }

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
  /* Copy results: the fit and the table as tab-separated text, in the same numbers the page shows. */
  function copyResults(s, pts, f, msgEl) {
    var used = pts.filter(function (q) { return q.m !== null || q.r !== null; });
    var lines = [example ? 'Calibration comparison (example numbers, not measured; Draft)' : 'Calibration comparison (hand-typed values; Draft)'];
    if (f.ok) lines.push('Gain (reading per newton of force)\t' + sig(f.a, 6), 'Zero offset (N)\t' + sig(f.b, 4), 'R²\t' + (f.r2 === null ? '—' : sig(f.r2, 6)), 'Points used\t' + f.n, 'Largest error (N)\t' + sig(f.big, 4));
    else lines.push(f.msg);
    lines.push('', ['Known mass (' + s.unit + ')', 'Force (N)', 'Reading (N)', 'Error (N)', 'Error (% of reading)', 'Outside tolerance'].join('\t'));
    used.forEach(function (q) { lines.push([sig(q.m, 5), sig(q.F, 5), sig(q.r, 5), sig(q.err, 4), q.pct === null ? '—' : sig(q.pct, 3) + ' %', s.tol === null ? '' : (q.out ? 'yes' : 'no')].join('\t')); });
    copyText(lines.join('\n') + '\n', function (ok) {
      if (!msgEl) return;
      msgEl.textContent = ok ? 'Copied' : 'Could not copy';
      setTimeout(function () { msgEl.textContent = ''; }, 2500);
    });
  }

  /* ---------- CSV record ---------- */
  function cell(v) {
    var s = v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
    if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = "'" + s; /* keep Excel from treating text as a formula */
    if (/[",;\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function n7(v) { return v === null || v === undefined || !isFinite(v) ? '' : String(parseFloat(Number(v).toPrecision(7))); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d, file) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (file ? '_' : ' ') + pad(d.getHours()) + (file ? '' : ':') + pad(d.getMinutes()) + (file ? '' : ':' + pad(d.getSeconds()));
  }
  function download(s, pts, f) {
    var now = new Date(), used = pts.filter(function (q) { return q.m !== null || q.r !== null; });
    var meta = [
      ['Biomaterials Tensile Tester', 'calibration record'],
      ['Source', example ? 'example numbers (not measured)' : 'entered by hand (not measured by this site)'],
      ['Status', 'draft; no claim of traceability or of meeting a standard'],
      ['Date', stamp(now)],
      ['Load cell', s.cell],
      ['Notes', s.notes],
      ['Mass unit', s.unit],
      ['Gravity g (m/s2)', s.g],
      ['Tolerance (+/- % of reading)', s.tol === null ? '' : s.tol],
      ['Points', used.length],
      ['Fit', 'reading = gain x force + offset (least squares)'],
      ['Gain', f.ok ? n7(f.a) : ''],
      ['Zero offset (N)', f.ok ? n7(f.b) : ''],
      ['R2', f.ok && f.r2 !== null ? n7(f.r2) : ''],
      ['Largest error (N)', f.ok ? n7(f.big) : ''],
      ['Suggested correction (not applied)', f.ok && f.corr ? 'corrected force = (reading - offset) / gain' : '']
    ];
    var out = meta.map(function (m) { return '# ' + m[0] + ',' + cell(m[1]); });
    out.push('mass_' + s.unit + ',force_N,reading_N,error_N,error_pct_of_reading,outside_tolerance');
    used.forEach(function (q) { out.push([n7(q.m), n7(q.F), n7(q.r), n7(q.err), n7(q.pct), s.tol === null ? '' : (q.out ? 'yes' : 'no')].join(',')); });
    var text = '﻿' + out.join('\r\n') + '\r\n';
    var base = 'calibration_' + ((s.cell || 'record').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'record') + '_' + stamp(now, true) + '.csv';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = base;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    dirty = false;
  }

  /* ---------- printed report (same one-page, Draft-labeled print window as the other pages) ---------- */
  var PRINT_COLORS = { 'var(--line)': '#d9ddd3', 'var(--muted)': '#4a5a50', 'var(--ink)': '#1f2a24', 'var(--accent)': '#3f6b52', 'var(--surface)': '#ffffff', 'var(--danger)': '#a63d40' };
  function printReport(s, pts, f) {
    var P = window.TensileReport;
    if (!P) return;
    var E = P.parts.esc, used = pts.filter(function (q) { return q.m !== null || q.r !== null; });
    var svg = chart(pts, f), end = svg.indexOf('</svg>');
    svg = end >= 0 ? svg.slice(0, end + 6) : '';
    Object.keys(PRINT_COLORS).forEach(function (k) { svg = svg.split(k).join(PRINT_COLORS[k]); });
    var det = [['Load cell', s.cell], ['Notes', s.notes], ['Mass unit', s.unit], ['Gravity, g (m/s²)', s.g], ['Tolerance (± % of reading)', s.tol === null ? '' : s.tol], ['Points', used.length]]
      .filter(function (d) { return d[1] !== '' && d[1] !== null && d[1] !== undefined; });
    var rowsHtml = used.map(function (q, i) {
      return '<tr><th scope="row">' + (i + 1) + '</th><td class="n">' + E(q.m === null ? '—' : sig(q.m, 6)) + '</td><td class="n">' + E(q.F === null ? '—' : sig(q.F, 5)) + '</td><td class="n">' + E(q.r === null ? '—' : sig(q.r, 5)) + '</td><td class="n">' + E(q.err === null ? '—' : sig(q.err, 4)) + '</td><td class="n">' + E(q.pct === null ? '—' : sig(q.pct, 3) + ' %') + '</td>' +
        (s.tol === null ? '' : '<td>' + (q.out ? 'Outside' : '') + '</td>') + '</tr>';
    }).join('');
    var fitHtml = f.ok ?
      '<table class="rp-table rp-fit"><tbody><tr><th scope="row">Gain (reading per newton of force)</th><td class="n">' + E(sig(f.a, 6)) + '</td></tr><tr><th scope="row">Zero offset (N)</th><td class="n">' + E(sig(f.b, 4)) + '</td></tr><tr><th scope="row">R²</th><td class="n">' + E(f.r2 === null ? '—' : sig(f.r2, 6)) + '</td></tr><tr><th scope="row">Points used</th><td class="n">' + E(f.n) + '</td></tr><tr><th scope="row">Largest error (N)</th><td class="n">' + E(sig(f.big, 4)) + '</td></tr></tbody></table>' +
      (f.corr ? '<p class="rp-note"><strong>Suggested correction (not applied by this site):</strong> corrected force = (reading − ' + E(sig(f.b, 4)) + ') ÷ ' + E(sig(f.a, 6)) + '</p>' : '') +
      '<p class="rp-note">Fit: reading = gain × force + offset, by least squares over the rows that have both a mass and a reading.</p>'
      : '<p class="rp-note">' + E(f.msg) + '</p>';
    var html = '<article class="report rp-cal">' + P.parts.head('Calibration report', example ? 'Example numbers, not measured' : 'Entered by hand (not measured by this site)') +
      '<p class="rp-warn"><strong>Tare is not a calibration.</strong> This page does not change any reading on the tester or on this site. Draft: no claim of traceability or of meeting a standard.</p>' +
      (det.length ? '<dl class="rp-details">' + det.map(function (d) { return '<div><dt>' + E(d[0]) + '</dt><dd>' + E(d[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
      '<h2>Points</h2><table class="rp-table"><thead><tr><th>#</th><th>Known mass (' + E(s.unit) + ')</th><th>Force from the mass (N)</th><th>Tester reading (N)</th><th>Error (N)</th><th>Error (% of reading)</th>' + (s.tol === null ? '' : '<th>Tolerance</th>') + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '<h2>Fit</h2>' + fitHtml +
      (svg ? '<figure class="rp-graph">' + svg + '</figure>' : '') +
      P.parts.foot() + '</article>';
    P.printHtml(html);
  }

  /* ---------- events ---------- */
  app.addEventListener('input', function (e) {
    var t = e.target, tr = t.closest ? t.closest('tr[data-i]') : null;
    if (tr && t.getAttribute('data-f')) rows[parseInt(tr.getAttribute('data-i'), 10)][t.getAttribute('data-f')] = t.value;
    dirty = true; update();
  });
  app.addEventListener('change', function (e) { if (e.target.id === 'c-unit') { dirty = true; update(); } });
  document.getElementById('c-add').addEventListener('click', function () { if (rows.length < MAX_ROWS) { rows.push({ m: '', r: '' }); renderRows(); update(); } });
  document.getElementById('c-remove').addEventListener('click', function () { if (rows.length > 1) { rows.pop(); renderRows(); update(); } });
  document.getElementById('c-clear').addEventListener('click', function () {
    rows = [{ m: '', r: '' }, { m: '', r: '' }, { m: '', r: '' }, { m: '', r: '' }, { m: '', r: '' }];
    example = false; dirty = false; renderRows(); update();
  });
  /* Example numbers: invented for illustration, clearly labeled, never measured. */
  document.getElementById('c-example').addEventListener('click', function () {
    var masses = [0, 200, 500, 1000, 2000, 5000], noise = [0.02, -0.03, 0.05, -0.04, 0.06, -0.05];
    document.getElementById('c-unit').value = 'g';
    document.getElementById('c-g').value = G0;
    rows = masses.map(function (m, i) { var F = m * 0.001 * G0; return { m: String(m), r: String(parseFloat((1.012 * F + 0.08 + noise[i]).toFixed(3))) }; });
    example = true; dirty = true; renderRows(); update();
  });
  function unsaved() { return dirty && rows.some(function (r) { return r.m !== '' || r.r !== ''; }); }
  /* A click on a link inside the site: the site's own "Leave without saving?" pop-up (ui.js). Closing the tab, reloading, and Back keep the browser's own box. */
  if (window.SiteUI) window.SiteUI.leaveGuard(function () {
    if (!unsaved()) return null;
    var b = document.getElementById('c-dl');
    return { text: 'The numbers typed on this page are not saved anywhere and will be lost.', stayNote: 'Keep your typed numbers on this page.', leaveNote: 'The typed numbers will be lost.', download: b && !b.disabled ? { label: 'Download record and leave', note: 'Saves the record first, then leaves.', run: function () { b.click(); } } : null };
  });
  window.addEventListener('beforeunload', function (e) {
    if (window.SiteUI && window.SiteUI.leaving) return;
    if (unsaved()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* "Need help?" and the one-minute hint use the sentence this page already shows above the table, until values are typed. */
  function coach() {
    if (!window.HelpCoach) return;
    window.HelpCoach.setContext(unsaved() ? null : { key: 'cal', title: 'Enter points', tutorial: 'calibration', lines: function () { var p = document.querySelector('#enter-section > p'); return [p ? p.textContent : '']; } });
  }
  app.addEventListener('input', coach); app.addEventListener('change', coach); app.addEventListener('click', coach);
  coach();
  renderRows();
  update();
})();
