/* Graph engine for every graph page. Plain SVG + vanilla JS, no libraries.
   window.TensileGraph.mount(root, options) draws an interactive graph with a readout, key results,
   graph customization, and PNG/SVG download. Three modes:
     example – labeled sample curves from window.SAMPLE_DATA (protocol pages)
     load    – one CSV file opened in the browser (Load Test page; nothing is uploaded or saved)
     live    – readings appended while a test runs (test pages, driven by live.js)
   Units: strain dimensionless, stress MPa, force N, displacement mm, time s. */
(function () {
  'use strict';

  var CONFIGS = {
    uniaxial: { name: 'Uniaxial tension', slug: 'uniaxial-tension', xLabel: 'Crosshead-based engineering strain, Δx/L₀ (mm/mm)', yLabel: 'Engineering stress, F/A₀ (MPa)' },
    relaxation: { name: 'Stress relaxation', slug: 'stress-relaxation', xLabel: 'Time, t (s)', yLabel: 'Stress, σ (MPa)' }
  };

  /* ---------- helpers ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sig(v, n) {
    if (v === null || v === undefined || v === '' || !isFinite(v)) return '—';
    return String(parseFloat(Number(v).toPrecision(n || 3)));
  }
  /* ---------- display choices (Settings page: stress unit, strain unit, digits) ----------
     These change only how numbers are written on the screen, in the graph images, and in the printed report and the
     Key results text. The recorded arrays, the calculations, the CSV, and the numeric columns of the Excel data sheet
     stay in base units (stress MPa, strain as a ratio, energy MJ/m3). */
  function pref(name, fallback) {
    var v = document.documentElement.getAttribute('data-' + name);
    return v === null || v === '' ? fallback : v;
  }
  function stressScale() { return pref('stressunit', 'mpa') === 'kpa' ? 1000 : 1; }
  function stressUnit() { return stressScale() === 1000 ? 'kPa' : 'MPa'; }
  function strainPct() { return pref('strainunit', 'ratio') === 'percent'; }
  function strainFactor() { return strainPct() ? 100 : 1; }
  function dsig(v, n) { /* sig() with the chosen number of digits (never fewer than the usual count) */
    var d = pref('digits', 'standard'), m = d === '4' ? 4 : d === '5' ? 5 : 0;
    return sig(v, m ? Math.max(n || 3, m) : n);
  }
  function fmtStress(v) { /* stress, or a modulus (stress per 1 of strain as a ratio, never per percent) */
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (stressScale() === 1000) return dsig(v * 1000) + ' kPa';
    return Math.abs(v) >= 1000 ? dsig(v / 1000) + ' GPa' : dsig(v) + ' MPa';
  }
  function fmtStrain(v, n) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return strainPct() ? dsig(v * 100, n) + ' %' : dsig(v, n);
  }
  function axisLabel(isRelax, which) {
    if (which === 'x') return isRelax ? 'Time, t (s)' : 'Crosshead-based engineering strain, Δx/L₀ (' + (strainPct() ? '%' : 'mm/mm') + ')';
    return isRelax ? 'Stress, σ (' + stressUnit() + ')' : 'Engineering stress, F/A₀ (' + stressUnit() + ')';
  }
  function niceTicks(lo, hi, n) {
    var raw = (hi - lo) / n;
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / p;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
    var ticks = [];
    for (var v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) {
      ticks.push(parseFloat(v.toPrecision(12)));
    }
    return { ticks: ticks, step: step };
  }
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[Math.floor(s.length / 2)];
  }
  function maxOf(a) { var m = -Infinity; for (var i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
  function peakIndex(Y) { var pk = 0; for (var i = 1; i < Y.length; i++) if (Y[i] > Y[pk]) pk = i; return pk; }

  /* ---------- records: raw force/displacement kept so dimensions can be edited ---------- */
  function area(p) { return p.specimen.width_mm * p.specimen.thickness_mm; }
  function initSample(r, isRelax) {
    var p = r.params, A0 = area(p), L0 = p.specimen.L0_mm;
    if (isRelax) {
      p.hold_mm = p.hold_strain * L0;
      r.raw = { t: r.x.slice(), F: r.y.map(function (v) { return v * A0; }) };
    } else {
      r.raw = { d: r.x.map(function (v) { return v * L0; }), F: r.y.map(function (v) { return v * A0; }) };
    }
    r.base = clone(p);
    r.baseLabel = 'Example dimensions';
  }
  function recompute(r, isRelax) {
    if (!r.raw) return;
    var p = r.params, A0 = area(p), L0 = p.specimen.L0_mm;
    r.y = r.raw.F.map(function (F) { return F / A0; });
    if (isRelax) { r.x = r.raw.t; p.hold_strain = p.hold_mm / L0; }
    else r.x = r.raw.d.map(function (d) { return d / L0; });
  }
  /* Default parameters for a test and material, taken from the sample record (example values). */
  function sampleParams(test, material) {
    var all = (window.SAMPLE_DATA || []).filter(function (r) { return r.test === test; });
    var r = all.filter(function (q) { return q.material === material; })[0] || all[0];
    if (!r) return null;
    var p = clone(r.params);
    if (test === 'relaxation') p.hold_mm = p.hold_strain * p.specimen.L0_mm;
    return p;
  }

  /* ---------- derived quantities (computed from the plotted data) ---------- */
  /* The automatic modulus estimate is the largest least-squares slope of stress against strain over a moving window of w
     consecutive points. Only windows that end at or before the peak stress are searched (the loading part), so data
     after the peak cannot win. loadingFit is the one place that chooses the window size and applies that limit; the
     Key results, the fit drawn on the graph, and the comparison numbers all call it, so they cannot disagree.
     It returns null when there is no usable window up to the peak. */
  function loadingFit(X, Y) {
    var n = X.length, w = n <= 300 ? 5 : Math.round(n / 60); /* 5 points for short curves (sample data); a wider window for long recordings so noise does not set the slope */
    var fit = maxSlopeAt(X, Y, w, peakIndex(Y));
    if (fit) fit.w = w;
    return fit;
  }
  function fitText(X, fit, forExport) { /* forExport: always the strain ratio, as the CSV and Excel keep base units */
    if (!fit) return '';
    var a = forExport || !strainPct() ? sig(X[fit.i0], 3) : sig(X[fit.i0] * 100, 3) + ' %', b = forExport || !strainPct() ? sig(X[fit.i1], 3) : sig(X[fit.i1] * 100, 3) + ' %';
    return 'Fitted over ε = ' + a + ' to ' + b + ' (' + fit.w + ' points).';
  }
  function uniaxialResults(rec) {
    var X = rec.x, Y = rec.y, n = X.length, p = rec.params;
    var rows = [
      ['Automatic modulus estimate, E', 'E = Δσ/Δε: largest fitted loading slope of σ vs ε found by the moving-window method (least squares over 5 points, or 1/60 of the points for long recordings). Not automatically a validated Young’s modulus; review the fitted interval.'],
      ['Yield strength, σ<sub>y</sub>', '0.2% offset: intersection of the curve with E(ε − 0.002).'],
      ['Ultimate tensile strength, UTS', 'UTS = max σ'],
      ['Estimated failure strain, ε<sub>f</sub> — force-drop rule', 'Last point before σ falls below 50% of UTS; this is not a confirmed rupture'],
      ['Energy density to recorded endpoint, U', 'U = ∫ σ dε from 0 to ε<sub>f</sub> (trapezoid rule)']
    ];
    if (n < 2) return rows.map(function (q) { return [q[0], '—', q[1]]; });
    var fit = loadingFit(X, Y), E = fit ? fit.slope : NaN;
    var pk = peakIndex(Y), uts = Y[pk];
    var f = pk;
    while (f + 1 < n && Y[f + 1] >= 0.5 * uts) f++;
    var tough = 0;
    for (var k = 1; k <= f; k++) tough += 0.5 * (Y[k] + Y[k - 1]) * (X[k] - X[k - 1]);
    var yieldTxt = 'not reported';
    if (p.yield) {
      yieldTxt = '—';
      for (var m = 1; m < n; m++) {
        var a = Y[m - 1] - E * (X[m - 1] - 0.002), b = Y[m] - E * (X[m] - 0.002);
        if (a >= 0 && b < 0) {
          var t = a / (a - b);
          yieldTxt = fmtStress(Y[m - 1] + t * (Y[m] - Y[m - 1]));
          break;
        }
      }
    }
    /* A force drop below 50% of the peak was found only if the walk above stopped before the last point. */
    var detected = f + 1 < n;
    if (!detected) {
      rows[3][1] = 'No force drop below 50% of UTS was found in this record, so no failure strain is reported (the record may be incomplete or stopped by hand).';
      rows[4][1] = 'U = ∫ σ dε from 0 to the last recorded point, because no force drop was found (trapezoid rule)';
    }
    if (fit) rows[0][1] += ' ' + fitText(X, fit) + (strainPct() ? ' Shown per 1 of strain (mm/mm), not per percent.' : '');
    else rows[0][1] = 'No fitting window was found up to the peak (too few loading points), so no modulus estimate is reported.';
    var vals = [fit ? fmtStress(E) : '—', yieldTxt, fmtStress(uts) + ' at ε = ' + fmtStrain(X[pk]), detected ? fmtStrain(X[f]) : 'not detected', dsig(tough) + ' MJ/m³'];
    return rows.map(function (q, i) { return [q[0], vals[i], q[1]]; });
  }
  /* Hold start, as the live auto-stop sees it: the first reading where displacement (measured from the first reading) reaches
     HOLD_START_FRACTION of the hold displacement. Returns { i, target } or { why } when it cannot be found. Display and reporting
     only; the ramp-peak stress used by the other relaxation results is not changed. */
  var HOLD_START_FRACTION = 0.98;
  function holdStart(rec) {
    var raw = rec.raw, p = rec.params || {}, n = rec.x.length;
    if (!raw || !raw.d || raw.d.length !== n) return { why: 'the record has no displacement column' };
    if (!(p.hold_mm > 0)) return { why: 'there is no hold displacement target' };
    for (var i = 0; i < n; i++) if (raw.d[i] - raw.d[0] >= HOLD_START_FRACTION * p.hold_mm) return { i: i, target: p.hold_mm };
    return { why: 'displacement never reaches ' + Math.round(HOLD_START_FRACTION * 100) + '% of the hold displacement in this record' };
  }
  function holdTargetSource(p) {
    return p.holdSource === 'header' ? 'the hold displacement in the file' : p.holdSource === 'median' ? 'the middle value of the file’s displacement column' :
      p.holdSource === 'median-strain' ? 'the middle value of the file’s strain column times the gauge length' : p.holdSource === 'edited' ? 'edited on this page' : 'typed on this page';
  }
  /* One line of text for the CSV header: where the hold started, or why it could not be found. */
  function holdStartText(rec) {
    var h = rec && rec.x && rec.x.length > 1 ? holdStart(rec) : null;
    if (!h) return '';
    return h.i === undefined ? 'not available because ' + h.why :
      'first reading at ' + Math.round(HOLD_START_FRACTION * 100) + '% of the ' + sig(h.target, 4) + ' mm hold displacement: t = ' + sig(rec.x[h.i], 4) + ' s, stress ' + sig(rec.y[h.i], 4) + ' MPa';
  }

  /* Hold starts at the peak stress (index 0 for sample curves; after the loading ramp for live data). */
  function relaxationResults(rec) {
    var X = rec.x, Y = rec.y, n = X.length;
    var blank = [['Ramp-peak stress, σ<sub>0</sub>', 'Highest stress in the record'], ['Hold-start stress', 'Stress at the first reading where displacement reaches ' + Math.round(HOLD_START_FRACTION * 100) + '% of the hold displacement'], ['Final recorded stress', 'Last recorded point of the hold; not automatically an equilibrium value'],
      ['Relaxed', '100 (1 − σ(t)/σ<sub>0</sub>) at end of hold, relative to the ramp-peak stress'], ['Apparent stress/strain ratio after ramp', 'Ramp-peak stress σ<sub>0</sub> divided by the hold strain ε<sub>0</sub>; not necessarily the instantaneous relaxation modulus'],
      ['Endpoint-referenced 1/e decay time, τ', 'Time for the decaying part, σ(t) − σ<sub>end</sub>, to fall to 1/e; depends on the recording duration. Measured from the ramp peak.']];
    if (n < 2) return blank.map(function (q) { return [q[0], '—', q[1]]; });
    var pk = peakIndex(Y), s0 = Y[pk], se = Y[n - 1], t0 = X[pk];
    var L0 = rec.params.specimen.L0_mm;
    var measured = rec.raw && rec.raw.d && rec.raw.d.length === n;
    var e0 = measured ? rec.raw.d[pk] / L0 : rec.params.hold_strain;
    var target = se + (s0 - se) / Math.E, tau = '—';
    for (var i = pk + 1; i < n; i++) {
      if (Y[i] <= target) {
        var t = (Y[i - 1] - target) / (Y[i - 1] - Y[i]);
        tau = dsig(X[i - 1] + t * (X[i] - X[i - 1]) - t0) + ' s';
        break;
      }
    }
    var hs = holdStart(rec);
    var hsRow = hs.i === undefined ?
      ['Hold-start stress', 'not available', 'Not available because ' + hs.why + '.'] :
      ['Hold-start stress', fmtStress(Y[hs.i]), 'Stress at the first reading where displacement, measured from the first reading, reaches ' + Math.round(HOLD_START_FRACTION * 100) + '% of the hold displacement (' + sig(hs.target, 4) + ' mm, ' + holdTargetSource(rec.params) + '); t = ' + sig(X[hs.i]) + ' s. It differs from the ramp-peak stress if the stress overshoots during the ramp.'];
    return [
      ['Ramp-peak stress, σ<sub>0</sub>', fmtStress(s0), 'Highest stress in the record' + (pk ? ' (t = ' + dsig(t0) + ' s)' : '') + '; hold strain ε<sub>0</sub> = ' + fmtStrain(e0) + (measured ? ' (measured)' : '')],
      hsRow,
      ['Final recorded stress at ' + (hs.i === undefined ? dsig(X[n - 1] - t0) + ' s after the ramp peak' : dsig(X[n - 1] - X[hs.i]) + ' s after the hold start'), fmtStress(se), 'Last recorded point of the hold; not automatically an equilibrium value'],
      ['Relaxed', dsig(100 * (1 - se / s0)) + ' %', '100 (1 − σ(t)/σ<sub>0</sub>) at end of hold, relative to the ramp-peak stress'],
      ['Apparent stress/strain ratio after ramp', fmtStress(s0 / e0), 'Ramp-peak stress σ<sub>0</sub> divided by the hold strain ε<sub>0</sub>; not necessarily the instantaneous relaxation modulus' + (strainPct() ? '. Shown per 1 of strain (mm/mm), not per percent' : '')],
      ['Endpoint-referenced 1/e decay time, τ', tau, 'Time for the decaying part, σ(t) − σ<sub>end</sub>, to fall to 1/e; depends on the recording duration. Measured from the ramp peak.']
    ];
  }

  /* ---------- key points and curve regions (display only; the results above are not changed) ----------
     Uses the same formulas as uniaxialResults / relaxationResults, but returns positions on the curve so
     they can be drawn. Computed only when the graph needs them. */
  function maxSlopeAt(X, Y, w, last) {
    var best = -Infinity, at = -1, bq = null, end = last === undefined ? X.length : last + 1; /* windows must end at index last or earlier */
    for (var i = 0; i + w <= end; i++) {
      var sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (var j = i; j < i + w; j++) { sx += X[j]; sy += Y[j]; sxx += X[j] * X[j]; sxy += X[j] * Y[j]; }
      var d = w * sxx - sx * sx;
      if (d > 0) {
        var sl = (w * sxy - sx * sy) / d;
        if (sl > best) { best = sl; at = i; bq = (sy - sl * sx) / w; }
      }
    }
    return at < 0 ? null : { slope: best, i0: at, i1: at + w - 1, b: bq };
  }
  function matKeyOf(r) {
    var m = r.mk || r.region || r.material;
    return m === 'biomaterial' || m === 'steel' || m === 'concrete' || m === 'plain' ? m : null;
  }
  /* Which region naming a sample material uses (see data/materials.js); used by the test pages. */
  function sampleRegion(test, material) {
    var all = (window.SAMPLE_DATA || []).filter(function (r) { return r.test === test; });
    var r = all.filter(function (q) { return q.material === material; })[0];
    return r ? (r.region || r.material) : material;
  }
  function keyPoints(r, isRelax) {
    var X = r.x, Y = r.y, n = X.length, k = { n: n, ok: false };
    if (n < 10) return k;
    var pk = peakIndex(Y);
    if (isRelax) {
      var s0 = Y[pk], se = Y[n - 1], t0 = X[pk], target = se + (s0 - se) / Math.E;
      k.ok = true; k.pk = pk; k.s0 = { x: t0, y: s0 }; k.send = { x: X[n - 1], y: se };
      var hsk = holdStart(r);
      if (hsk.i !== undefined) k.hs = { x: X[hsk.i], y: Y[hsk.i] };
      for (var i = pk + 1; i < n; i++) {
        if (Y[i] <= target) {
          var t = (Y[i - 1] - target) / (Y[i - 1] - Y[i]);
          k.tau = { x: X[i - 1] + t * (X[i] - X[i - 1]), y: target, t0: t0 };
          break;
        }
      }
      return k;
    }
    var fit = loadingFit(X, Y);
    if (!fit) return k;
    var f = pk;
    while (f + 1 < n && Y[f + 1] >= 0.5 * Y[pk]) f++;
    k.ok = true; k.fit = fit; k.E = fit.slope; k.pk = pk; k.f = f;
    k.detected = f + 1 < n; /* false = stress never fell below 50% of the peak, so there is no failure point */
    k.uts = { x: X[pk], y: Y[pk] }; k.fail = k.detected ? { x: X[f], y: Y[f] } : null;
    if (r.params && r.params.yield) {
      for (var m = 1; m < n; m++) {
        var a = Y[m - 1] - fit.slope * (X[m - 1] - 0.002), b = Y[m] - fit.slope * (X[m] - 0.002);
        if (a >= 0 && b < 0) {
          var u = a / (a - b);
          k.yield = { x: X[m - 1] + u * (X[m] - X[m - 1]), y: Y[m - 1] + u * (Y[m] - Y[m - 1]) };
          break;
        }
      }
    }
    /* End of the skin toe region: no standard definition. Drawn where the slope first reaches half of the
       steepest slope, and labeled "approximate, for illustration". */
    for (var q = 1; q <= pk; q++) {
      if (X[q] > X[q - 1] && (Y[q] - Y[q - 1]) / (X[q] - X[q - 1]) >= 0.5 * fit.slope) { k.toe = X[q]; break; }
    }
    return k;
  }
  /* Region boundaries for the textbook-style guides: [name, from, to, approximate?] in data units. */
  function regionsFor(r, k, isRelax) {
    if (!k || !k.ok) return [];
    if (isRelax) {
      var xe = r.x[r.x.length - 1], out = [];
      if (k.pk > 0) out.push(['Ramp', r.x[0], k.s0.x]);
      out.push(['Hold', k.s0.x, xe]);
      return out;
    }
    var mk = matKeyOf(r), up = k.uts.x, xf = k.fail ? k.fail.x : null;
    /* Without a detected force drop there is no failure point, so the region after the peak is not drawn. */
    function post(name) { return xf === null ? [] : [[name, up, xf]]; }
    if (mk === 'concrete') return [['Near-linear', 0, up]].concat(post('Fracture'));
    if (mk === 'plain') return [['Loading', 0, up]].concat(post('Failure'));
    if (mk === 'biomaterial' || !r.params.yield) {
      if (k.toe && k.toe < up) return [['Toe (approx.)', 0, k.toe, true], ['Linear', k.toe, up]].concat(post('Failure'));
      return [['Loading', 0, up]].concat(post('Failure'));
    }
    if (k.yield && k.yield.x < up) return [['Elastic', 0, k.yield.x], ['Strain hardening', k.yield.x, up]].concat(post('Necking'));
    return [['Loading', 0, up]].concat(post('Failure'));
  }

  /* Numeric versions of the Key results, for comparing specimens (compare.js). They use the same formulas as
     uniaxialResults / relaxationResults above (no calculation is changed); values are in MPa, s, %, MJ/m3. */
  function numbers(rec, isRelax) {
    var X = rec.x, Y = rec.y, n = X.length, o = {}, i;
    if (n < 2) return o;
    var pk = peakIndex(Y);
    if (isRelax) {
      var s0 = Y[pk], se = Y[n - 1], t0 = X[pk], L0 = rec.params.specimen.L0_mm;
      var measured = rec.raw && rec.raw.d && rec.raw.d.length === n;
      var e0 = measured ? rec.raw.d[pk] / L0 : rec.params.hold_strain;
      var target = se + (s0 - se) / Math.E, tau = null;
      for (i = pk + 1; i < n; i++) {
        if (Y[i] <= target) { var t = (Y[i - 1] - target) / (Y[i - 1] - Y[i]); tau = X[i - 1] + t * (X[i] - X[i - 1]) - t0; break; }
      }
      var hsn = holdStart(rec);
      o.hs = hsn.i === undefined ? null : Y[hsn.i];
      o.s0 = s0; o.send = se; o.relaxed = 100 * (1 - se / s0); o.E0 = e0 > 0 ? s0 / e0 : null; o.tau = tau;
      return o;
    }
    var p = rec.params, fitN = loadingFit(X, Y), E = fitN ? fitN.slope : NaN;
    var uts = Y[pk], f = pk;
    while (f + 1 < n && Y[f + 1] >= 0.5 * uts) f++;
    var tough = 0;
    for (var k = 1; k <= f; k++) tough += 0.5 * (Y[k] + Y[k - 1]) * (X[k] - X[k - 1]);
    var yv = null;
    if (p.yield) {
      for (var m = 1; m < n; m++) {
        var a = Y[m - 1] - E * (X[m - 1] - 0.002), b = Y[m] - E * (X[m] - 0.002);
        if (a >= 0 && b < 0) { yv = Y[m - 1] + (a / (a - b)) * (Y[m] - Y[m - 1]); break; }
      }
    }
    o.E = isFinite(E) ? E : null; o.yield = yv; o.uts = uts; o.utsStrain = X[pk]; o.failStrain = f + 1 < n ? X[f] : null; o.tough = tough;
    return o;
  }

  /* ---------- data checks (warnings only; nothing here changes, drops, or reorders a reading) ----------
     Looks at the recorded arrays for two things that make slopes and times unreliable or stop the force-drop
     option from acting, and returns plain-language text for the screen, the CSV header, Excel, and the report. */
  function dataChecks(r, isRelax) {
    var out = { items: [], checked: false, text: '' };
    if (!r || r.source === 'sample') return out;
    var raw = r.raw, T = (raw && raw.t) || r.checkT || (isRelax && r.direct ? r.x : null), i;
    if (T && T.length > 1) {
      var bad = 0, last = NaN;
      for (i = 0; i < T.length; i++) {
        if (!isFinite(T[i])) continue;
        if (isFinite(last) && !(T[i] > last)) bad++;
        last = T[i];
      }
      out.checked = true;
      if (bad) out.items.push(bad + (bad === 1 ? ' reading had a time equal to or earlier than the one before.' : ' readings had a time equal to or earlier than the one before.') +
        ' The recorded times may not be in order, so slopes and times may be unreliable. The data is kept unchanged.');
    }
    if (!isRelax && raw && raw.F && raw.F.length) {
      var need = (window.DEVICE && window.DEVICE.breakDetect && window.DEVICE.breakDetect.minPeakForce_N) || 1, pk = maxOf(raw.F);
      out.checked = true;
      if (isFinite(pk) && pk < need) out.items.push('The highest force was ' + sig(pk, 3) + ' N, below the ' + need + ' N the force-drop option needs, so it could not send STOP. The data is kept unchanged.');
    }
    if (r.skippedLines > 0) { out.checked = true; out.items.push(r.skippedLines + (r.skippedLines === 1 ? ' unreadable line was' : ' unreadable lines were') + ' skipped while recording.'); }
    out.text = out.items.length ? out.items.join(' ') : (out.checked ? 'No data-quality problems found by these checks. This does not confirm the data is valid.' : '');
    return out;
  }

  /* ---------- where the specimen dimensions came from (labeling only; no calculation depends on it) ---------- */
  var DIM_TEXT = {
    typed: 'typed by the user',
    example: 'example values (not measured)',
    file: 'read from the file',
    'file-example': 'example values, as declared in the file (not measured)',
    assumed: 'example values assumed because the file had none (not measured)',
    edited: 'entered on this page',
    'not-needed': 'not needed (stress and strain given)'
  };
  function dimSourceText(r) { return r && r.dimSource ? DIM_TEXT[r.dimSource] || '' : ''; }
  function dimIsExample(r) { return !!r && (r.dimSource === 'example' || r.dimSource === 'file-example' || r.dimSource === 'assumed'); }

  /* ---------- CSV reading (auto-detects columns by header keywords) ---------- */
  var ALIAS = {
    time: ['time', 't', 'sec', 'seconds'],
    disp: ['displacement', 'extension', 'elongation', 'disp'],
    force: ['force', 'load'],
    strain: ['strain'],
    stress: ['stress']
  };
  var UNITS = {
    time: { s: 1, sec: 1, ms: 0.001, min: 60 },
    disp: { mm: 1, cm: 10, m: 1000, um: 0.001 },
    force: { n: 1, kn: 1000, lbf: 4.44822 },
    strain: { '%': 0.01, percent: 0.01 },
    stress: { mpa: 1, kpa: 0.001, pa: 1e-6, gpa: 1000, psi: 0.00689476 }
  };
  function classify(h) {
    var tokens = h.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim().split(' ');
    for (var q in ALIAS) {
      for (var i = 0; i < tokens.length; i++) {
        if (ALIAS[q].indexOf(tokens[i]) >= 0) {
          var f = 1;
          tokens.forEach(function (tk, j) { if (j !== i && UNITS[q][tk] !== undefined) f = UNITS[q][tk]; });
          return { q: q, f: f };
        }
      }
    }
    return null;
  }
  /* Lines starting with "#" are notes. Files saved by this site's test pages use "# Key,Value" lines
     (test, material, dimensions, ...); those values are read back so old tests reopen correctly. */
  var META_KEYS = [
    ['test', 'test'], ['source', 'source'], ['material', 'material'], ['specimen id', 'id'], ['date', 'date'],
    ['gauge length', 'L0'], ['width', 'W'], ['thickness', 'T'], ['crosshead speed', 'speed'],
    ['hold displacement', 'hold_mm'], ['hold duration', 'hold_s'], ['temperature', 'temp'],
    ['environment', 'env'], ['notes', 'notes'], ['dimensions source', 'dimsrc']
  ];
  function readMeta(line, meta) {
    var body = line.replace(/^["']?#\s*/, '');
    var m = body.match(/^([^,;\t]*)[,;\t](.*)$/);
    if (!m) return;
    var key = m[1].replace(/"/g, '').trim().toLowerCase();
    var val = m[2].replace(/[,;\t]+$/, '').trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"').replace(/^'(?=[=+\-@])/, '');
    META_KEYS.forEach(function (k) { if (key.indexOf(k[0]) === 0 && meta[k[1]] === undefined) meta[k[1]] = val; });
  }
  function numMeta(v) { var x = parseFloat(String(v === undefined ? '' : v).replace(',', '.')); return x > 0 ? x : null; }
  function parseCSV(text, isRelax) {
    var meta = {}, lines = [];
    text.replace(/^﻿/, '').split(/\r?\n/).forEach(function (l) {
      var t = l.trim();
      if (!t || /^[,;\t]*$/.test(t)) return;
      if (/^["']?#/.test(t)) readMeta(t, meta);
      else lines.push(l);
    });
    if (meta.test && /relax/i.test(meta.test) !== isRelax) {
      throw new Error('This file is from a ' + meta.test.toLowerCase() + ' test. Choose ' + (isRelax ? 'Uniaxial Tension' : 'Stress Relaxation') + ' above and open it again.');
    }
    if (lines.length < 11) throw new Error('The file needs a header row and at least 10 data rows.');
    if (lines.length > 200001) throw new Error('Too many rows (limit 200,000).');
    var delim = ',';
    [';', '\t'].forEach(function (d) { if (lines[0].split(d).length > lines[0].split(delim).length) delim = d; });
    var heads = lines[0].split(delim).map(function (h) { return h.trim().replace(/^"|"$/g, ''); });
    var cols = {};
    heads.forEach(function (h, i) { var c = classify(h); if (c && !cols[c.q]) cols[c.q] = { i: i, f: c.f }; });
    var dims = numMeta(meta.L0) && numMeta(meta.W) && numMeta(meta.T) ? { L0_mm: numMeta(meta.L0), width_mm: numMeta(meta.W), thickness_mm: numMeta(meta.T) } : null;
    var mode, need;
    if (isRelax) {
      if (!cols.time || !(cols.stress || cols.force)) throw new Error('Stress relaxation needs a time column plus a stress or force column. Found: ' + heads.join(', ') + '.');
      mode = cols.force && (dims || !cols.stress) ? 'raw' : 'direct';
      need = ['time', mode === 'raw' ? 'force' : 'stress'];
    } else if (cols.disp && cols.force && (dims || !(cols.strain && cols.stress))) { mode = 'raw'; need = ['disp', 'force']; }
    else if (cols.strain && cols.stress) { mode = 'direct'; need = ['strain', 'stress']; }
    else throw new Error('Uniaxial tension needs strain + stress, or displacement + force, columns. Found: ' + heads.join(', ') + '.');
    var holdQ = isRelax ? (cols.disp ? 'disp' : (cols.strain ? 'strain' : null)) : null;
    var out = { mode: mode, a: [], b: [], hold: [], holdQ: holdQ, meta: meta, dims: dims, t: [] };
    for (var r = 1; r < lines.length; r++) {
      var cells = lines[r].split(delim).map(function (c) { c = c.trim().replace(/^"|"$/g, ''); return delim === ';' ? c.replace(',', '.') : c; });
      var vals = need.map(function (q) { var c = cells[cols[q].i]; return c === undefined || c === '' ? NaN : Number(c) * cols[q].f; });
      if (vals.some(function (v) { return !isFinite(v); })) continue;
      out.a.push(vals[0]); out.b.push(vals[1]);
      if (cols.time && !isRelax) out.t.push(cells[cols.time.i] === undefined || cells[cols.time.i] === '' ? NaN : Number(cells[cols.time.i]) * cols.time.f); /* kept only for the data checks */
      if (holdQ) out.hold.push(Number(cells[cols[holdQ].i]) * cols[holdQ].f);
    }
    if (out.a.length < 10) throw new Error('Fewer than 10 rows contain valid numbers in the ' + need.join(' and ') + ' columns.');
    if (isRelax) { var t0 = out.a[0]; out.a = out.a.map(function (v) { return v - t0; }); }
    return out;
  }
  function materialKey(name) {
    var s = String(name || '').toLowerCase();
    return /skin|bio|tissue/.test(s) ? 'biomaterial' : /steel/.test(s) ? 'steel' : /concrete/.test(s) ? 'concrete' : null;
  }
  /* Builds a graph record from a CSV file's text. Throws an Error with a plain-language message. */
  function fromCSV(name, text, test) {
    var isRelax = test === 'relaxation';
    var d = parseCSV(text, isRelax), meta = d.meta, mk = materialKey(meta.material);
    var p = sampleParams(test, mk || 'biomaterial');
    if (d.dims) p.specimen = d.dims;
    p.yield = !isRelax && mk !== 'biomaterial';
    p.rate_per_s = ''; p.preload_N = '';
    p.temperature_C = meta.temp || ''; p.environment = meta.env || '';
    var simulated = /simul/i.test(meta.source || '');
    var bits = ['Loaded from "' + name + '" in this browser tab only (not uploaded or saved)'];
    if (meta.material) bits.push('material: ' + meta.material);
    if (meta.id) bits.push('specimen ID: ' + meta.id);
    if (meta.date) bits.push('recorded: ' + meta.date);
    if (meta.source) bits.push('source: ' + meta.source);
    if (meta.notes) bits.push('notes: ' + meta.notes);
    p.model = bits.join('; ');
    var r = { id: 'loaded', test: test, material: 'loaded', mk: mk, label: 'Your data: ' + name, fileName: name, source: 'loaded', simulated: simulated,
      units: { x: isRelax ? 's' : '-', y: 'MPa' }, params: p, direct: d.mode === 'direct', x: [], y: [],
      dimsFromFile: !!d.dims, baseLabel: d.dims ? 'Dimensions in file' : 'Example dimensions',
      specimenId: meta.id || '', materialText: meta.material || '', fileDate: meta.date || '' };
    if (isRelax) {
      var h = d.hold.filter(isFinite);
      p.hold_s = numMeta(meta.hold_s) || Math.round(maxOf(d.a));
      if (numMeta(meta.hold_mm)) { p.hold_mm = numMeta(meta.hold_mm); p.hold_strain = p.hold_mm / p.specimen.L0_mm; p.holdSource = 'header'; }
      else if (d.holdQ === 'strain' && h.length) { p.hold_strain = median(h); p.hold_mm = p.hold_strain * p.specimen.L0_mm; p.holdSource = 'median-strain'; }
      else if (d.holdQ === 'disp' && h.length) { p.hold_mm = median(h); p.hold_strain = p.hold_mm / p.specimen.L0_mm; p.holdSource = 'median'; }
      if (d.mode === 'direct') { r.x = d.a; r.y = d.b; }
      else {
        r.raw = { t: d.a, F: d.b };
        if (d.holdQ === 'disp' && h.length === d.a.length) r.raw.d = d.hold;
      }
    } else if (d.mode === 'direct') { r.x = d.a; r.y = d.b; }
    else r.raw = { d: d.a, F: d.b };
    if (d.t.length && d.t.length === d.a.length) r.checkT = d.t;
    r.dimSource = r.direct ? 'not-needed' : !d.dims ? 'assumed' : /example/i.test(meta.dimsrc || '') ? 'file-example' : 'file';
    r.dimSourceBase = r.dimSource;
    r.base = clone(p);
    recompute(r, isRelax);
    return r;
  }

  function sourceTag(r) {
    if (r.source === 'sample') return 'Sample data, not measured';
    if (r.source === 'simulated') return 'Simulated data, not measured';
    if (r.source === 'measured') return 'Measured data';
    if (r.source === 'loaded') return 'Loaded file: ' + r.fileName + (r.simulated ? ' (declared simulated, not measured)' : ' (data origin not verified)');
    return '';
  }

  /* ---------- the interactive graph ---------- */
  var W = 720, H = 420, M = { l: 74, r: 24, t: 50, b: 62 };
  var SCREEN = { bg: null, axis: 'var(--muted)', grid: 'var(--line)', text: 'var(--ink)', muted: 'var(--muted)', ring: 'var(--bg)' };
  var EXPORT = { bg: '#ffffff', axis: '#4a5a50', grid: '#d9ddd3', text: '#1f2a24', muted: '#4a5a50', ring: '#ffffff' };

  /* Hand-drawn schematic of the usual skin curve regions. Not data: no numbers, no scale. */
  var SCHEMATIC = '<svg class="schem-svg" viewBox="0 0 480 210" role="img" aria-label="Schematic of skin curve regions: slack, toe, linear, failure. Illustration, not data.">' +
    '<defs><marker id="sc-ar" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7z" style="fill:var(--muted)"/></marker></defs>' +
    '<line x1="40" y1="180" x2="450" y2="180" style="stroke:var(--muted);stroke-width:1.5"/><line x1="40" y1="180" x2="40" y2="30" style="stroke:var(--muted);stroke-width:1.5"/>' +
    '<text x="450" y="200" text-anchor="end" style="fill:var(--ink);font-size:12px">Strain →</text><text x="46" y="38" style="fill:var(--ink);font-size:12px">Stress ↑</text>' +
    '<text x="450" y="20" text-anchor="end" style="fill:var(--ink);font-size:12px;font-style:italic">Illustration, not data</text>' +
    [110, 220, 340, 385].map(function (x) { return '<line x1="' + x + '" y1="52" x2="' + x + '" y2="180" stroke-dasharray="5 4" style="stroke:var(--muted);stroke-width:1.25"/>'; }).join('') +
    [['Slack', 40, 110], ['Toe', 110, 220], ['Linear', 220, 340], ['Failure', 340, 385]].map(function (q) {
      var cx = (q[1] + q[2]) / 2;
      return '<line x1="' + (q[1] + 3) + '" y1="62" x2="' + (q[2] - 3) + '" y2="62" marker-start="url(#sc-ar)" marker-end="url(#sc-ar)" style="stroke:var(--muted);stroke-width:1.25"/>' +
        '<text x="' + cx + '" y="78" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-style:italic">' + q[0] + '</text>';
    }).join('') +
    '<path d="M40 180 L110 180 Q170 178 220 150 L340 70 Q362 60 372 74 L385 176" fill="none" style="stroke:var(--accent);stroke-width:3;stroke-linejoin:round"/></svg>';

  /* The page's current font (Settings > Font), so graph text and downloaded images match it. */
  function fontStack() {
    try { return getComputedStyle(document.body).fontFamily.replace(/"/g, "'"); } catch (e) { return 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'; }
  }

  function mount(root, opts) {
    opts = opts || {};
    var testKey = opts.test || root.getAttribute('data-test');
    var CFG = CONFIGS[testKey];
    var isRelax = testKey === 'relaxation';
    var mode = opts.mode || 'example';
    if (!CFG) return null;
    var records;
    if (mode === 'example') {
      records = clone((window.SAMPLE_DATA || []).filter(function (r) { return r.test === testKey; }));
      records.forEach(function (r) { initSample(r, isRelax); });
    } else records = [opts.record];
    if (!records.length || !records[0]) return null;

    var choices = null; /* example mode: which materials the Material choice offers (null = all) */
    /* Starting graph appearance comes from the Settings page (saved display choices); the per-graph controls
       below the graph change it for this graph only, and "Reset to defaults" returns to these. Display only. */
    function savedLook(name, fallback) {
      var v = document.documentElement.getAttribute('data-' + name);
      return v === null || v === '' ? fallback : v;
    }
    var gridPref = savedLook('grid', 'major'), widthPref = parseFloat(savedLook('linewidth', '3'));
    var DEFAULTS = { color: null, width: widthPref >= 1 && widthPref <= 6 ? widthPref : 3, title: null, xLabel: null, yLabel: null, grid: gridPref !== 'off', minor: gridPref === 'minor',
      style: savedLook('curve', 'line') === 'markers' ? 'markers' : 'line', logx: false };
    var st = { mat: records[0].material };
    if (opts.material && records.some(function (r) { return r.material === opts.material; })) st.mat = opts.material;
    var lockMat = !!opts.lockMaterial;
    var idx = 0, geom = null;
    /* view: null = automatic scales; otherwise a zoomed window {x0,x1,y0,y1} in data units (display only) */
    var view = null, shown = {}, hl = null, tangentOn = false, dragging = null;
    var regionsOn = mode !== 'live', regionsTouched = false, wasFollow = false, kpCache = null;
    function resetCustom() { for (var k in DEFAULTS) st[k] = DEFAULTS[k]; }
    resetCustom();
    function rec() { return records.filter(function (r) { return r.material === st.mat; })[0]; }
    function defTitle() { return CFG.name + ' – ' + rec().label; }
    function startIndex() {
      var r = rec();
      if (!r.x.length) return 0;
      if (isRelax) return Math.floor(r.x.length / 2);
      return peakIndex(r.y);
    }

    /* Curve for the original dimensions, drawn dashed when the user changes dimensions */
    function ghostCurve(r) {
      if (!r.raw || !r.base) return null;
      var p = r.params.specimen, b = r.base.specimen;
      if (p.L0_mm === b.L0_mm && p.width_mm === b.width_mm && p.thickness_mm === b.thickness_mm) return null;
      var A0 = b.width_mm * b.thickness_mm, L0 = b.L0_mm;
      return { x: isRelax ? r.raw.t : r.raw.d.map(function (d) { return d / L0; }), y: r.raw.F.map(function (F) { return F / A0; }) };
    }

    /* Key points are recomputed only when the curve changes. */
    function kpts(r) {
      var n = r.x.length;
      var sg = [n, r.x[0], r.x[n - 1], r.y[n - 1], r.y[n >> 1], r.params && r.params.yield, matKeyOf(r)].join('|');
      if (!kpCache || kpCache.r !== r || kpCache.sg !== sg) kpCache = { r: r, sg: sg, k: keyPoints(r, isRelax) };
      return kpCache.k;
    }
    var KEYS = isRelax ? ['s0', 'hs', 'send', 'relaxed', 'E0', 'tau'] : ['E', 'yield', 'uts', 'fail', 'tough'];
    function keyAvailable(key, k) {
      if (!k || !k.ok) return false;
      if (key === 'yield') return !!k.yield;
      if (key === 'fail') return !!k.fail;
      if (key === 'tau') return !!k.tau;
      if (key === 'hs') return !!k.hs;
      return true;
    }

    /* Textbook-style region guides (under the curve) and key-result points (over it). */
    function overlays(r, pal, o, g) {
      var res = { under: '', over: '' };
      if (o.noOverlay) return res;
      var anyShown = KEYS.some(function (q) { return shown[q]; }), active = !o.exp && hl;
      if (!regionsOn && !anyShown && !active) return res;
      var k = kpts(r);
      if (!k || !k.ok) return res;
      var mark = o.exp ? '#b45309' : 'var(--mark)';
      var inX = function (v) { var x = g.sx(v); return x >= M.l - 0.5 && x <= W - M.r + 0.5; };
      var u = '', v = '';
      if (regionsOn) {
        var regs = regionsFor(r, k, isRelax), tiers = [-1e9, -1e9, -1e9];
        regs.forEach(function (rg, i) {
          if (i > 0 && inX(rg[1]) && g.sx(rg[1]) > M.l + 1) u += '<line x1="' + g.sx(rg[1]).toFixed(1) + '" x2="' + g.sx(rg[1]).toFixed(1) + '" y1="' + M.t + '" y2="' + (H - M.b) + '" stroke-dasharray="5 4" style="stroke:' + pal.muted + ';stroke-width:1.25"/>';
        });
        regs.forEach(function (rg) {
          var a = Math.max(g.sx(rg[1]), M.l), b = Math.min(g.sx(rg[2]), W - M.r);
          if (!(b - a > 4)) return;
          var lw = rg[0].length * 6.2 + 8, cx = Math.min(Math.max((a + b) / 2, M.l + lw / 2), W - M.r - lw / 2), t = 0;
          while (t < 2 && cx - lw / 2 < tiers[t] + 3) t++;
          tiers[t] = cx + lw / 2;
          u += '<line x1="' + (a + 2).toFixed(1) + '" x2="' + (b - 2).toFixed(1) + '" y1="' + (M.t + 9) + '" y2="' + (M.t + 9) + '" marker-start="url(#gl-ar)" marker-end="url(#gl-ar)" style="stroke:' + pal.muted + ';stroke-width:1.25"/>';
          u += '<text x="' + cx.toFixed(1) + '" y="' + (M.t + 23 + t * 13) + '" text-anchor="middle" style="fill:' + pal.text + ';font-size:11px;font-style:italic;paint-order:stroke;stroke:' + pal.ring + ';stroke-width:3px">' + esc(rg[0]) + '</text>';
        });
      }
      var placed = []; /* label boxes already drawn, so two results marked at the same place do not print on top of each other */
      function pt(p, label, strong, below) {
        if (!p || !inX(p.x)) return;
        var cx = g.sx(p.x), cy = g.sy(p.y);
        if (cy < M.t - 1 || cy > H - M.b + 1) return;
        var right = cx > W - M.r - 90;
        v += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (strong ? 8 : 5) + '" style="fill:' + pal.ring + ';stroke:' + mark + ';stroke-width:' + (strong ? 3.5 : 2.5) + '"/>';
        if (label) {
          var lx = cx + (right ? -11 : 11), ly = cy + (below ? 17 : -9), lw = label.length * 6.8 + 4, step = below ? 14 : -14, tries = 0;
          function hit() { var x0 = right ? lx - lw : lx; return placed.some(function (b) { return x0 < b.x1 && x0 + lw > b.x0 && ly - 12 < b.y1 && ly + 3 > b.y0; }); }
          while (tries < 6 && hit()) { ly += step; tries++; }
          placed.push({ x0: right ? lx - lw : lx, x1: (right ? lx - lw : lx) + lw, y0: ly - 12, y1: ly + 3 });
          v += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + (right ? 'end' : 'start') + '" style="fill:' + pal.text + ';font-size:12px;font-weight:' + (strong ? 700 : 600) + ';paint-order:stroke;stroke:' + pal.ring + ';stroke-width:3px">' + esc(label) + '</text>';
        }
      }
      function seg(x1, y1, x2, y2, strong, dash) {
        v += '<line x1="' + g.sx(x1).toFixed(1) + '" y1="' + g.sy(y1).toFixed(1) + '" x2="' + g.sx(x2).toFixed(1) + '" y2="' + g.sy(y2).toFixed(1) + '"' + (dash ? ' stroke-dasharray="6 4"' : '') + ' clip-path="url(#plot-clip)" style="stroke:' + mark + ';stroke-width:' + (strong ? 3 : 2) + '"/>';
      }
      var X = r.x, Y = r.y;
      function draw1(key) {
        var strong = !o.exp && hl === key;
        if (!keyAvailable(key, k)) return;
        if (key === 'E') {
          var f = k.fit, span = g.xTop - g.xLo, xs = Math.max(g.xLo, X[f.i0] - 0.02 * span);
          var xe = Math.min(g.xTop, X[f.i1] + 0.12 * span, (g.yTop * 0.95 - f.b) / f.slope);
          if (xe > xs) seg(xs, f.slope * xs + f.b, xe, f.slope * xe + f.b, strong, true);
          var d = '';
          for (var i = f.i0; i <= f.i1; i++) d += (i === f.i0 ? 'M' : 'L') + g.sx(X[i]).toFixed(1) + ' ' + g.sy(Y[i]).toFixed(1);
          v += '<path d="' + d + '" fill="none" clip-path="url(#plot-clip)" style="stroke:' + mark + ';stroke-width:' + (strong ? 6 : 4.5) + ';stroke-linecap:round"/>';
          var xm = (X[f.i0] + X[f.i1]) / 2;
          pt({ x: xm, y: f.slope * xm + f.b }, 'E (fitted slope)', strong, true);
        } else if (key === 'yield') {
          seg(0.002, 0, k.yield.x, k.yield.y, strong, true);
          pt(k.yield, 'σy (0.2% offset)', strong, true);
        } else if (key === 'uts') pt(k.uts, 'UTS', strong);
        else if (key === 'fail') pt(k.fail, 'Failure', strong, true);
        else if (key === 'tough') {
          var step = Math.max(1, Math.ceil(k.f / 1500)), a = '';
          for (var j = 0; j <= k.f; j += step) a += (j ? 'L' : 'M') + g.sx(X[j]).toFixed(1) + ' ' + g.sy(Y[j]).toFixed(1);
          a += 'L' + g.sx(X[k.f]).toFixed(1) + ' ' + g.sy(Y[k.f]).toFixed(1) + 'L' + g.sx(X[k.f]).toFixed(1) + ' ' + g.sy(0).toFixed(1) + 'L' + g.sx(0).toFixed(1) + ' ' + g.sy(0).toFixed(1) + 'Z';
          u += '<path d="' + a + '" clip-path="url(#plot-clip)" style="fill:' + mark + ';opacity:' + (strong ? 0.3 : 0.2) + '"/>';
        } else if (key === 's0') pt(k.s0, 'σ₀', strong);
        else if (key === 'E0') pt(k.s0, 'σ₀/ε₀ ratio', strong);
        else if (key === 'hs') pt(k.hs, 'hold start', strong, true);
        else if (key === 'send') pt(k.send, 'σ final', strong, true);
        else if (key === 'relaxed') {
          seg(k.s0.x, k.s0.y, k.send.x, k.s0.y, strong, true);
          seg(k.send.x, k.s0.y, k.send.x, k.send.y, strong, false);
          pt({ x: k.send.x, y: (k.s0.y + k.send.y) / 2 }, 'relaxed', strong);
        } else if (key === 'tau') {
          seg(k.tau.x, 0, k.tau.x, k.tau.y, strong, true);
          seg(k.tau.t0, k.tau.y, k.tau.x, k.tau.y, strong, true);
          pt(k.tau, 'τ', strong, true);
        }
      }
      KEYS.forEach(function (q) { if (shown[q] || (active && hl === q)) draw1(q); });
      res.under = u; res.over = v;
      return res;
    }

    function build(r, pal, o) {
      o = o || {};
      var X = r.x, Y = r.y, n = X.length;
      var log = st.logx && isRelax;
      var pw = W - M.l - M.r, ph = H - M.t - M.b;
      var G = ghostCurve(r);
      var xmax = Math.max(maxOf(X), G ? maxOf(G.x) : -Infinity), ymax = Math.max(maxOf(Y), G ? maxOf(G.y) : -Infinity);
      if (!(xmax > 0)) xmax = isRelax ? (r.params.hold_s > 0 ? Number(r.params.hold_s) : 60) : 0.1;
      if (!(ymax > 0)) ymax = 1;
      var xmin = 0, xTicks, xTop = xmax;
      if (log) {
        var pos = X.filter(function (v) { return v > 0; });
        if (!pos.length) log = false;
        else {
          xmin = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, pos))));
          xTicks = [];
          for (var d = Math.ceil(Math.log10(xmin)); Math.pow(10, d) <= xmax * 1.0001; d++) xTicks.push(Math.pow(10, d));
        }
      }
      if (!log) {
        var nt = niceTicks(0, xmax, 8);
        xTop = Math.ceil(xmax / nt.step - 1e-9) * nt.step;
        xTicks = niceTicks(0, xTop, 8).ticks;
      }
      var room = regionsOn && !follow && !o.noOverlay && n >= 10 ? 1.2 : 1.04;
      var yt = niceTicks(0, ymax * room, 5);
      var yTop = Math.ceil(ymax * room / yt.step) * yt.step;
      var yTicks = niceTicks(0, yTop, 5).ticks;
      var xLo = 0, yLo = 0, base = { x1: xTop, y1: yTop };
      if (view && !log) {
        xLo = view.x0; xTop = view.x1; yLo = view.y0; yTop = view.y1;
        xTicks = niceTicks(xLo, xTop, 8).ticks; yTicks = niceTicks(yLo, yTop, 5).ticks;
      }
      var lo = Math.log10(xmin || 1), hi = Math.log10(xTop);
      function sx(v) { return M.l + (log ? (Math.log10(v) - lo) / (hi - lo) : (v - xLo) / (xTop - xLo)) * pw; }
      function sy(v) { return M.t + ph - ((v - yLo) / (yTop - yLo)) * ph; }

      var series = st.color || (o.exp ? '#3f6b52' : 'var(--accent)');
      var title = st.title !== null ? st.title : defTitle();
      var xl = st.xLabel !== null ? st.xLabel : axisLabel(isRelax, 'x');
      var yl = st.yLabel !== null ? st.yLabel : axisLabel(isRelax, 'y');
      var scale = o.scale || 1;
      var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' +
        (o.exp ? ' width="' + W * scale + '" height="' + H * scale + '"' : ' role="img" aria-label="' + esc(title) + '"') +
        ' font-family="' + fontStack() + '">';
      s += '<defs><clipPath id="plot-clip"><rect x="' + M.l + '" y="' + (M.t - 8) + '" width="' + (pw + 8) + '" height="' + (ph + 8) + '"/></clipPath>' +
        '<marker id="gl-ar" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7z" style="fill:' + pal.muted + '"/></marker></defs>';
      if (pal.bg) s += '<rect width="' + W + '" height="' + H + '" fill="' + pal.bg + '"/>';
      s += '<text x="' + M.l + '" y="28" style="fill:' + pal.text + ';font-size:17px;font-weight:600">' + esc(title) + '</text>';

      if (st.grid) {
        yTicks.forEach(function (v) {
          s += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + sy(v) + '" y2="' + sy(v) + '" style="stroke:' + pal.grid + ';stroke-width:1"/>';
        });
        xTicks.forEach(function (v) {
          if (v <= xLo + (xTop - xLo) * 1e-9) return;
          s += '<line x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.grid + ';stroke-width:1"/>';
        });
        if (st.minor && !log) {
          /* minor grid (Settings: Major + minor): a half-weight line midway between neighbouring major lines */
          for (var mi = 0; mi + 1 < yTicks.length; mi++) {
            var my = sy((yTicks[mi] + yTicks[mi + 1]) / 2);
            s += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + my + '" y2="' + my + '" style="stroke:' + pal.grid + ';stroke-width:0.5;opacity:0.6"/>';
          }
          for (var mj = 0; mj + 1 < xTicks.length; mj++) {
            var mx = sx((xTicks[mj] + xTicks[mj + 1]) / 2);
            s += '<line x1="' + mx + '" x2="' + mx + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.grid + ';stroke-width:0.5;opacity:0.6"/>';
          }
        }
        if (log) {
          for (var dd = Math.floor(Math.log10(xmin)); dd < Math.ceil(hi); dd++) {
            for (var m = 2; m < 10; m++) {
              var v = m * Math.pow(10, dd);
              if (v > xmin && v < xTop) s += '<line x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.grid + ';stroke-width:0.5;opacity:0.6"/>';
            }
          }
        }
      }
      s += '<line x1="' + M.l + '" x2="' + (W - M.r) + '" y1="' + (H - M.b) + '" y2="' + (H - M.b) + '" style="stroke:' + pal.axis + ';stroke-width:1.5"/>';
      s += '<line x1="' + M.l + '" x2="' + M.l + '" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.axis + ';stroke-width:1.5"/>';
      yTicks.forEach(function (v) {
        s += '<text x="' + (M.l - 9) + '" y="' + (sy(v) + 4) + '" text-anchor="end" style="fill:' + pal.muted + ';font-size:12px">' + sig(v * stressScale(), 6) + '</text>';
      });
      xTicks.forEach(function (v) {
        s += '<text x="' + sx(v) + '" y="' + (H - M.b + 20) + '" text-anchor="middle" style="fill:' + pal.muted + ';font-size:12px">' + sig(isRelax ? v : v * strainFactor(), 6) + '</text>';
      });
      s += '<text x="' + (M.l + pw / 2) + '" y="' + (H - 16) + '" text-anchor="middle" style="fill:' + pal.text + ';font-size:13px">' + esc(xl) + '</text>';
      s += '<text transform="translate(18 ' + (M.t + ph / 2) + ') rotate(-90)" text-anchor="middle" style="fill:' + pal.text + ';font-size:13px">' + esc(yl) + '</text>';

      /* Screen positions for every point (used by the readout); long recordings draw a thinned path that keeps each bucket's min and max. */
      var px = [], i;
      for (i = 0; i < n; i++) px.push(log && X[i] <= 0 ? null : sx(X[i]));
      var keep = [], r0 = 0, r1 = n - 1;
      if (view && !log) {
        while (r0 < n - 1 && X[r0 + 1] < xLo) r0++;
        while (r1 > r0 && X[r1 - 1] > xTop) r1--;
      }
      var cnt = r1 - r0 + 1, stride = cnt > 4000 ? Math.ceil(cnt / 2000) : 1;
      if (stride === 1) for (i = r0; i <= r1; i++) keep.push(i);
      else {
        for (var b0 = r0; b0 <= r1; b0 += stride) {
          var lo2 = b0, hi2 = b0;
          for (var j = b0; j <= Math.min(r1, b0 + stride - 1); j++) { if (Y[j] < Y[lo2]) lo2 = j; if (Y[j] > Y[hi2]) hi2 = j; }
          if (lo2 === hi2) keep.push(lo2); else keep.push(Math.min(lo2, hi2), Math.max(lo2, hi2));
        }
      }
      var d2 = '', started = false;
      keep.forEach(function (k) {
        if (px[k] === null) return;
        d2 += (started ? 'L' : 'M') + px[k].toFixed(1) + ' ' + sy(Y[k]).toFixed(1);
        started = true;
      });
      var ov = overlays(r, pal, o, { sx: sx, sy: sy, xLo: xLo, xTop: xTop, yLo: yLo, yTop: yTop });
      s += ov.under;
      if (G) {
        var gd = '', gs = false;
        for (i = 0; i < G.x.length; i++) {
          if (log && G.x[i] <= 0) continue;
          gd += (gs ? 'L' : 'M') + sx(G.x[i]).toFixed(1) + ' ' + sy(G.y[i]).toFixed(1); gs = true;
        }
        var gl = r.baseLabel || 'Example dimensions';
        s += '<path d="' + gd + '" fill="none" stroke-dasharray="6 4" clip-path="url(#plot-clip)" style="stroke:' + pal.muted + ';stroke-width:1.75"/>';
        var gr = o.exp ? W - M.r : W - M.r - 104; /* on screen, leave room for the zoom icons at the top right */
        s += '<line x1="' + (gr - gl.length * 6.2 - 34) + '" x2="' + (gr - gl.length * 6.2 - 8) + '" y1="24" y2="24" stroke-dasharray="6 4" style="stroke:' + pal.muted + ';stroke-width:1.75"/>';
        s += '<text x="' + gr + '" y="28" text-anchor="end" style="fill:' + pal.muted + ';font-size:11px">' + esc(gl) + '</text>';
      }
      if (d2) s += '<path d="' + d2 + '" fill="none" stroke-linejoin="round" stroke-linecap="round" clip-path="url(#plot-clip)" style="stroke:' + series + ';stroke-width:' + st.width + '"/>';
      if (st.style === 'markers' && n) {
        var every = Math.max(1, Math.round(n / 24));
        for (i = 0; i < n; i += every) {
          if (px[i] === null) continue;
          s += '<circle cx="' + px[i].toFixed(1) + '" cy="' + sy(Y[i]).toFixed(1) + '" r="' + (3 + st.width / 3).toFixed(1) + '" clip-path="url(#plot-clip)" style="fill:' + series + ';stroke:' + pal.ring + ';stroke-width:1.5"/>';
        }
      }
      s += ov.over;
      if (!n && opts.emptyText) {
        s += '<text x="' + (M.l + pw / 2) + '" y="' + (M.t + ph / 2) + '" text-anchor="middle" style="fill:' + pal.muted + ';font-size:15px">' + esc(opts.emptyText) + '</text>';
      }
      /* The data-source line has its own row under the title, so a long file name cannot run into the x-axis title. */
      s += '<text x="' + M.l + '" y="43" style="fill:' + pal.muted + ';font-size:11px;font-style:italic">' + esc(sourceTag(r)) + '</text>';
      if (!o.exp) s += '<g id="cur" clip-path="url(#plot-clip)" style="pointer-events:none"><line id="cur-t" style="display:none;stroke:' + pal.text + ';stroke-width:1.5"/><line id="cur-l" y1="' + M.t + '" y2="' + (H - M.b) + '" style="stroke:' + pal.text + ';stroke-width:1;stroke-dasharray:4 3"/><circle id="cur-c" r="6" style="fill:' + series + ';stroke:' + pal.text + ';stroke-width:2"/></g>';
      s += '</svg>';
      if (!o.exp) geom = { px: px, sx: sx, sy: sy, xLo: xLo, xTop: xTop, yLo: yLo, yTop: yTop, base: base, log: log };
      return s;
    }

    /* ---------- UI ---------- */
    var swatches = [['#3f6b52', 'Forest green'], ['#2f6f8f', 'Blue'], ['#b4691f', 'Orange'], ['#7a4f9a', 'Purple'], ['#a63d40', 'Red'], ['#1f2a24', 'Charcoal']]
      .map(function (c) { return '<button type="button" class="swatch" data-color="' + c[0] + '" style="background:' + c[0] + '" aria-label="Line color: ' + c[1] + '"></button>'; }).join('');

    /* Load Test and New Test put the toolbar (regions, tangent, downloads) directly under the graph, with Readout and Key results
       in a column on the right. Load Test also shows the editable test parameters under the toolbar; New Test has its own setup card. */
    var stacked = (mode === 'load' || mode === 'live');
    var paramsStacked = '<section class="params-block" aria-labelledby="params-title"><h2 id="params-title">Test parameters</h2>' +
      '<div class="param-fields" id="params"></div>' +
      '<div class="graph-actions"><button type="button" class="btn-secondary" id="p-reset">Reset parameters</button></div>' +
      '<details class="tips"><summary>About these values</summary><p class="param-note" id="param-note"></p><p class="model" id="model"></p></details></section>';
    root.innerHTML =
      (mode === 'example' ? '<fieldset class="segmented"' + (lockMat ? ' hidden' : '') + '><legend>Material</legend><div class="options" id="mats"></div></fieldset>' : '') +
      '<div class="graph-grid">' +
        '<div class="graph-main">' +
          '<div class="chart-frame">' +
            '<div class="chart-wrap" tabindex="0" role="group" aria-label="Interactive graph. Use the left and right arrow keys to move the readout; Home and End jump to the ends; plus and minus zoom; square brackets move the view left and right when zoomed."></div>' +
            '<div class="zoom-tools" role="group" aria-label="Zoom">' +
              '<button type="button" id="z-in" title="Zoom in (+)" aria-label="Zoom in"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
              '<button type="button" id="z-out" title="Zoom out (−)" aria-label="Zoom out"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
              '<button type="button" id="z-reset" title="Reset view (double-click the graph)" aria-label="Reset view"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
            '</div>' +
            '<div class="zoom-box" id="zoom-box" hidden></div>' +
          '</div>' +
          '<p class="range-note" id="range-note" aria-live="polite"></p>' +
          '<p class="data-checks" id="dq" role="status" hidden></p>' +
          '<p class="data-checks" id="dimsrc" hidden></p>' +
          (mode === 'example' ? '<p class="hint">Hover or use ← → (Shift for larger steps), Home, and End to read values. Scroll over the graph or press + / − to zoom, or drag a box around an area. When zoomed, drag to move, press [ and ] to move left and right, and double-click to reset.</p>' : '<details class="tips"><summary>Graph tips</summary><p class="hint">Hover or use ← → (Shift for larger steps), Home, and End to read values. Scroll over the graph or press + / − to zoom, or drag a box around an area. When zoomed, drag to move, press [ and ] to move left and right, and double-click to reset.</p><p class="hint">Select a result’s name to highlight it on the graph.</p></details>') +
          (stacked ? '<div class="graph-toolbar">' : '') +
          '<div class="graph-toggles">' +
            '<label class="check"><input type="checkbox" id="t-regions"> Show regions</label>' +
            (isRelax ? '' : '<label class="check"><input type="checkbox" id="t-tangent"> Tangent line at cursor</label>') +
          '</div>' +
          '<div class="graph-actions" id="g-actions">' +
            '<button type="button" class="btn-secondary" id="dl-png">Download PNG</button>' +
            '<button type="button" class="btn-secondary" id="dl-svg">Download SVG</button>' +
            (window.TensileExcel ? '<button type="button" class="btn-secondary" id="dl-xlsx">Download for Excel (.xlsx)</button>' : '') +
            (mode === 'load' && window.TensileReport ? '<button type="button" class="btn-secondary" id="dl-print">Print report</button>' : '') +
          '</div>' +
          (stacked ? '</div>' + (mode === 'load' ? paramsStacked : '') : '') +
          '<details class="schematic" id="schem" hidden><summary>Soft-tissue curve regions (schematic)</summary>' + SCHEMATIC +
            '<p class="def">Illustration, not data. Region names follow common descriptions of skin and similar soft tissues; where one region ends and the next begins varies between specimens.</p></details>' +
          '<details class="customize"><summary>Customize graph</summary><div class="fields">' +
            '<label>Title<input type="text" id="f-title"></label>' +
            '<label>X-axis label<input type="text" id="f-x"></label>' +
            '<label>Y-axis label<input type="text" id="f-y"></label>' +
            '<label>Style<select id="f-style"><option value="line">Line</option><option value="markers">Line + markers</option></select></label>' +
            '<label>Line width <output id="f-w-out"></output><input type="range" id="f-w" min="1" max="6" step="0.5"></label>' +
            '<div class="field-color"><span>Line color</span><div class="color-row"><input type="color" id="f-color" aria-label="Custom line color">' + swatches + '</div></div>' +
            '<label class="check"><input type="checkbox" id="f-grid"> Show grid</label>' +
            (isRelax ? '<label class="check"><input type="checkbox" id="f-log"> Logarithmic time axis</label>' : '') +
            '<div><button type="button" class="btn-secondary" id="f-reset">Reset to defaults</button></div>' +
          '</div></details>' +
        '</div>' +
        '<aside class="graph-side' + (mode === 'example' ? '' : ' compact') + '" aria-labelledby="gs-readout-title gs-results-title">' +
          '<div class="gs-a"><h2 id="gs-readout-title">Readout</h2><dl class="readout" id="readout"></dl></div>' +
          '<div class="gs-b"><h2 id="gs-results-title">Key results</h2>' +
          '<div class="res-tools"><span>Show on graph:</span><button type="button" class="btn-secondary btn-small" id="show-all">Show all</button><button type="button" class="btn-secondary btn-small" id="hide-all">Hide all</button>' + (mode === 'example' ? '' : '<label class="check defs-toggle"><input type="checkbox" id="show-defs"> Show definitions</label>') + '</div>' +
          '<table class="results"><tbody id="results"></tbody></table>' +
          (mode === 'example' ? '<p class="def" id="res-note">Select a result’s name to highlight it on the graph.</p>' : '') + '</div>' +
        '</aside>' +
      '</div>' +
      (mode !== 'live' && !stacked ?
        '<h2>Test parameters</h2><div class="param-fields" id="params"></div>' +
        '<p class="param-note" id="param-note"></p>' +
        '<div class="graph-actions"><button type="button" class="btn-secondary" id="p-reset">Reset parameters</button></div>' +
        '<p class="model" id="model"></p>' : '') +
      '<div class="sr-only" id="live" aria-live="polite"></div>';

    var wrap = root.querySelector('.chart-wrap');
    var readout = root.querySelector('#readout');
    var live = root.querySelector('#live');
    var el = {
      title: root.querySelector('#f-title'), x: root.querySelector('#f-x'), y: root.querySelector('#f-y'),
      style: root.querySelector('#f-style'), w: root.querySelector('#f-w'), wOut: root.querySelector('#f-w-out'),
      color: root.querySelector('#f-color'), grid: root.querySelector('#f-grid'), log: root.querySelector('#f-log')
    };
    function bind(node, evt, fn) { if (node) node.addEventListener(evt, fn); }

    function renderMats() {
      var box = root.querySelector('#mats');
      if (!box) return;
      box.innerHTML = records.filter(function (r) { return !choices || choices.indexOf(r.material) >= 0; }).map(function (r) {
        return '<label><input type="radio" name="material" value="' + r.material + '"' + (r.material === st.mat ? ' checked' : '') + '> ' + esc(r.label) + '</label>';
      }).join('');
      root.querySelectorAll('input[name="material"]').forEach(function (rad) {
        rad.addEventListener('change', function () { if (rad.checked) { st.mat = rad.value; drawMaterial(); } });
      });
    }

    function syncControls() {
      el.title.value = st.title !== null ? st.title : defTitle();
      el.x.value = st.xLabel !== null ? st.xLabel : axisLabel(isRelax, 'x');
      el.y.value = st.yLabel !== null ? st.yLabel : axisLabel(isRelax, 'y');
      el.style.value = st.style;
      el.w.value = st.width; el.wOut.textContent = st.width + ' px';
      el.color.value = st.color || '#3f6b52';
      el.grid.checked = st.grid;
      if (el.log) el.log.checked = st.logx;
    }

    function readoutRows(i) {
      var r = rec(), X = r.x, Y = r.y, raw = r.raw, rows;
      var F = raw && raw.F ? ['Force, F', dsig(raw.F[i], 4) + ' N'] : null;
      var D = raw && raw.d ? ['Crosshead displacement', dsig(raw.d[i], 4) + ' mm'] : null;
      if (isRelax) {
        var pk = peakIndex(Y), s0 = Y[pk], e0 = r.params.hold_strain, ratio = Y[i] / s0, hold = i >= pk;
        rows = [['Time, t', dsig(X[i]) + ' s'], ['Stress, σ(t)', fmtStress(Y[i])], F, D,
          ['Ratio, σ(t)/σ<sub>0</sub>', hold ? dsig(ratio, 4) : 'loading'], ['Relaxed', hold ? dsig(100 * (1 - ratio)) + ' %' : '—'],
          ['Apparent stress/strain ratio, σ(t)/ε<sub>0</sub>', hold ? fmtStress(Y[i] / e0) : '—']];
      } else {
        var T = raw && raw.t ? ['Time, t', dsig(raw.t[i], 4) + ' s'] : null;
        var a = i > 0 ? i - 1 : 0, b = i > 0 ? i : 1, dx = X[b] - X[a]; /* slope of the segment ending at this point */
        rows = [T, ['Strain, ε', fmtStrain(X[i], 4)], ['Stress, σ', fmtStress(Y[i])], F, D,
          ['Local slope estimate, dσ/dε', dx && X.length > 1 ? fmtStress((Y[b] - Y[a]) / dx) : '—'],
          ['Estimated true strain, ε<sub>t</sub>', fmtStrain(Math.log(1 + X[i]), 4)], ['Estimated true stress, σ<sub>t</sub> — uniform, constant-volume assumption', fmtStress(Y[i] * (1 + X[i]))]];
      }
      return rows.filter(Boolean);
    }

    function setCursor(i, announce) {
      var r = rec(), n = r.x.length;
      var cur = wrap.querySelector('#cur');
      if (!n) {
        if (cur) cur.style.display = 'none';
        readout.innerHTML = '<dt>Waiting for data</dt><dd>—</dd>';
        return;
      }
      while (geom.px[i] === null && i < n - 1) i++;
      idx = Math.max(0, Math.min(n - 1, i));
      var x = geom.px[idx], y = geom.sy(r.y[idx]);
      var line = wrap.querySelector('#cur-l'), dot = wrap.querySelector('#cur-c');
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      var tl = wrap.querySelector('#cur-t');
      if (tl) {
        var ta = idx > 0 ? idx - 1 : 0, tb = idx > 0 ? idx : 1, tdx = r.x[tb] - r.x[ta];
        if (tangentOn && !isRelax && n > 1 && tdx > 0 && isFinite(r.y[tb] - r.y[ta])) {
          var tsl = (r.y[tb] - r.y[ta]) / tdx, hw = (geom.xTop - geom.xLo) * 0.1;
          tl.setAttribute('x1', geom.sx(r.x[idx] - hw)); tl.setAttribute('y1', geom.sy(r.y[idx] - tsl * hw));
          tl.setAttribute('x2', geom.sx(r.x[idx] + hw)); tl.setAttribute('y2', geom.sy(r.y[idx] + tsl * hw));
          tl.style.display = '';
        } else tl.style.display = 'none';
      }
      var rows = readoutRows(idx);
      readout.innerHTML = rows.map(function (q) { return '<dt>' + q[0] + '</dt><dd>' + q[1] + '</dd>'; }).join('');
      if (announce) live.textContent = rows.slice(0, 2).map(function (q) { return q[0].replace(/<[^>]+>/g, '') + ' ' + q[1]; }).join(', ');
    }

    /* The visible range, written out so zoomed values can be read exactly. */
    function rangeText(none) {
      if (none || !geom) return '';
      if (!view || geom.log) return 'Showing the whole curve.';
      function f(lo, hi, k) {
        lo *= k; hi *= k;
        var d = Math.max(0, Math.min(8, 2 - Math.floor(Math.log10(hi - lo))));
        return lo.toFixed(d) + '–' + hi.toFixed(d);
      }
      return 'Showing ' + (isRelax ? 'time ' + f(geom.xLo, geom.xTop, 1) + ' s' : 'strain ' + f(geom.xLo, geom.xTop, strainFactor()) + (strainPct() ? ' %' : '')) + ', stress ' + f(geom.yLo, geom.yTop, stressScale()) + ' ' + stressUnit() + '.';
    }

    function draw() {
      var r = rec();
      wrap.innerHTML = build(r, SCREEN);
      setCursor(idx);
      var none = r.x.length < 2;
      root.querySelector('#dl-png').disabled = none;
      root.querySelector('#dl-svg').disabled = none;
      var xl = root.querySelector('#dl-xlsx');
      if (xl) xl.disabled = none || follow;
      var pr = root.querySelector('#dl-print');
      if (pr) pr.disabled = none;
      var noZoom = none || (geom && geom.log);
      root.querySelector('#z-in').disabled = noZoom; root.querySelector('#z-out').disabled = noZoom || !view;
      root.querySelector('#z-reset').disabled = !view;
      wrap.classList.toggle('zoomed', !!view);
      root.querySelector('#range-note').textContent = rangeText(none);
      root.querySelector('#schem').hidden = matKeyOf(r) !== 'biomaterial';
      var rg = root.querySelector('#t-regions'); if (rg) { rg.checked = regionsOn; rg.disabled = none || follow; }
    }

    function plain(t) { return String(t).replace(/<[^>]+>/g, ''); }
    function renderResults(r) {
      var dq = root.querySelector('#dq'), dc = follow ? null : dataChecks(r, isRelax);
      if (dq) { dq.textContent = dc ? dc.text : ''; dq.hidden = !(dc && dc.text); dq.className = 'data-checks' + (dc && dc.items.length ? ' warn' : ''); }
      var ds = root.querySelector('#dimsrc'), dtxt = follow || r.source === 'sample' ? '' : dimSourceText(r);
      if (ds) { ds.textContent = dtxt ? 'Dimensions: ' + dtxt + '.' : ''; ds.hidden = !dtxt; ds.className = 'data-checks' + (dimIsExample(r) ? ' warn' : ''); }
      var res = isRelax ? relaxationResults(r) : uniaxialResults(r);
      var k = follow ? null : kpts(r);
      root.querySelector('#results').innerHTML = res.map(function (q, i) {
        var key = KEYS[i], on = keyAvailable(key, k), dis = on ? '' : ' disabled';
        return '<tr data-key="' + key + '"><th scope="row"><div class="res-head"><input type="checkbox" class="res-show" data-show="' + key + '" aria-label="Show ' + esc(plain(q[0])) + ' on graph"' + dis + '><button type="button" class="res-btn" data-hl="' + key + '" aria-pressed="false"' + dis + '>' + q[0] + '</button></div><span class="def">' + q[2] + '</span></th><td>' + q[1] + '</td></tr>';
      }).join('');
      syncRows();
    }
    function syncRows() {
      root.querySelectorAll('#results tr').forEach(function (tr) {
        var key = tr.getAttribute('data-key'), b = tr.querySelector('.res-btn'), c = tr.querySelector('input');
        b.setAttribute('aria-pressed', hl === key ? 'true' : 'false');
        tr.classList.toggle('is-hl', hl === key);
        c.checked = !!shown[key] && !c.disabled;
      });
    }

    /* editable parameters: dimensions (and hold displacement) recompute the graph; the rest are labels */
    function paramFields(r) {
      var p = r.params, sp = p.specimen, off = r.direct;
      var f = [
        { k: 'L0', label: 'Gauge length, L<sub>0</sub> (mm)', num: true, off: off, get: function () { return sp.L0_mm; }, set: function (v) { sp.L0_mm = v; } },
        { k: 'W', label: 'Width (mm)', num: true, off: off, get: function () { return sp.width_mm; }, set: function (v) { sp.width_mm = v; } },
        { k: 'T', label: 'Thickness (mm)', num: true, off: off, get: function () { return sp.thickness_mm; }, set: function (v) { sp.thickness_mm = v; } },
        { k: 'A0', label: 'Area, A<sub>0</sub> (mm²)', out: function () { return sig(area(p), 4); } }
      ];
      if (isRelax) {
        if (off) f.push({ k: 'E0', label: 'Hold strain, ε<sub>0</sub>', num: true, get: function () { return p.hold_strain; }, set: function (v) { p.hold_strain = v; } });
        else {
          f.push({ k: 'DL', label: 'Applied displacement, ΔL (mm)', num: true, get: function () { return p.hold_mm; }, set: function (v) { p.hold_mm = v; p.holdSource = 'edited'; } });
          f.push({ k: 'E0', label: 'Hold strain, ε<sub>0</sub> = ΔL/L<sub>0</sub>', out: function () { return fmtStrain(p.hold_strain, 4); } });
        }
        f.push({ k: 'HS', label: 'Hold duration (s)', get: function () { return p.hold_s; }, set: function (v) { p.hold_s = v; } });
      } else {
        f.push({ k: 'RT', label: 'Strain rate (s<sup>−1</sup>)', get: function () { return p.rate_per_s; }, set: function (v) { p.rate_per_s = v; } });
        f.push({ k: 'PL', label: 'Preload (N)', get: function () { return p.preload_N; }, set: function (v) { p.preload_N = v; } });
      }
      f.push({ k: 'TC', label: 'Temperature (°C)', get: function () { return p.temperature_C; }, set: function (v) { p.temperature_C = v; } });
      f.push({ k: 'EN', label: 'Environment', get: function () { return p.environment; }, set: function (v) { p.environment = v; } });
      if (!isRelax) f.push({ k: 'YL', label: 'Report 0.2% offset yield', check: true, get: function () { return p.yield; }, set: function (v) { p.yield = v; } });
      return f;
    }
    var fieldDefs = [];
    function renderParams(r) {
      if (mode === 'live') return;
      fieldDefs = paramFields(r);
      root.querySelector('#params').innerHTML = fieldDefs.map(function (d) {
        if (d.out) return '<div class="pf"><span>' + d.label + '</span><output data-o="' + d.k + '">' + d.out() + '</output></div>';
        if (d.check) return '<label class="pf pf-check"><input type="checkbox" data-k="' + d.k + '"' + (d.get() ? ' checked' : '') + '><span>' + d.label + '</span></label>';
        return '<label class="pf"><span>' + d.label + '</span><input data-k="' + d.k + '" ' + (d.num ? 'type="number" min="0" step="any"' : 'type="text"') + (d.off ? ' disabled' : '') + ' value="' + esc(d.get()) + '"></label>';
      }).join('');
      var tail = ' Rate, preload, hold duration, temperature, and environment are recorded notes and do not change the curve.';
      var note = r.direct ? 'Loaded as stress and strain: dimensions do not change this curve.' + tail :
        r.source === 'loaded' ? (r.dimsFromFile ?
          'Stress and strain are calculated from the force and displacement in the file using the dimensions saved in it. Editing them demonstrates how entered geometry affects calculated stress and strain; it does not predict how a real specimen would behave at a different size. A dashed line shows the file’s dimensions.' + tail :
          'Stress and strain are calculated from the loaded force and displacement using these dimensions, which start at example values. Example dimensions are not measurements; enter the specimen’s measured dimensions.' + tail) :
        'These controls demonstrate how entered geometry affects calculated stress and strain. They do not predict how a real specimen’s behavior changes when its size changes. The graph remains illustrative; a dashed line shows the example dimensions for comparison.' + tail;
      root.querySelector('#param-note').textContent = note;
      root.querySelector('#model').textContent = (r.source === 'sample' ? 'Sample data, not measured. Generated from: ' : 'Source: ') + r.params.model + '.';
    }
    function refreshDerived() {
      fieldDefs.forEach(function (d) {
        if (d.out) { var o = root.querySelector('[data-o="' + d.k + '"]'); if (o) o.textContent = d.out(); }
      });
    }
    bind(root.querySelector('#params'), 'input', function (e) {
      var t = e.target, d = fieldDefs.filter(function (q) { return q.k === t.getAttribute('data-k'); })[0];
      if (!d) return;
      var r = rec();
      if (d.check) d.set(t.checked);
      else if (d.num) {
        var v = parseFloat(t.value);
        if (!(v > 0)) { t.setAttribute('aria-invalid', 'true'); return; }
        t.removeAttribute('aria-invalid');
        d.set(v);
        if (r.dimSourceBase && !r.direct && (d.k === 'L0' || d.k === 'W' || d.k === 'T')) r.dimSource = 'edited'; /* label only */
      } else d.set(t.value);
      recompute(r, isRelax);
      refreshDerived();
      renderResults(r);
      draw();
    });
    bind(root.querySelector('#p-reset'), 'click', function () {
      var r = rec();
      r.params = clone(r.base);
      if (r.dimSourceBase) r.dimSource = r.dimSourceBase;
      recompute(r, isRelax);
      renderParams(r); renderResults(r); draw();
    });

    function drawMaterial() {
      var r = rec();
      view = null; hl = null; shown = {};
      idx = startIndex();
      renderResults(r); renderParams(r);
      syncControls();
      draw();
    }

    /* ---------- events ---------- */
    bind(el.title, 'input', function () { st.title = el.title.value; draw(); });
    bind(el.x, 'input', function () { st.xLabel = el.x.value; draw(); });
    bind(el.y, 'input', function () { st.yLabel = el.y.value; draw(); });
    bind(el.style, 'change', function () { st.style = el.style.value; draw(); });
    bind(el.w, 'input', function () { st.width = parseFloat(el.w.value); el.wOut.textContent = st.width + ' px'; draw(); });
    bind(el.color, 'input', function () { st.color = el.color.value; draw(); });
    bind(el.grid, 'change', function () { st.grid = el.grid.checked; draw(); });
    bind(el.log, 'change', function () { st.logx = el.log.checked; draw(); });
    root.querySelectorAll('.swatch').forEach(function (b) {
      b.addEventListener('click', function () { st.color = b.getAttribute('data-color'); el.color.value = st.color; draw(); });
    });
    bind(root.querySelector('#f-reset'), 'click', function () { resetCustom(); syncControls(); draw(); });

    function nearest(clientX) {
      var svg = wrap.querySelector('svg'), box = svg.getBoundingClientRect();
      var vx = (clientX - box.left) * (W / box.width), best = -1, bd = Infinity;
      for (var i = 0; i < geom.px.length; i++) {
        if (geom.px[i] === null) continue;
        var d = Math.abs(geom.px[i] - vx);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    var follow = false;
    /* Dragging: when zoomed, drag moves the view; otherwise (or with Shift held) drag draws a box to zoom to. */
    var press = null, frame = wrap.parentNode, zbox = root.querySelector('#zoom-box');
    function plotClient() {
      var b = wrap.querySelector('svg').getBoundingClientRect(), kx = b.width / W, ky = b.height / H;
      return { l: b.left + M.l * kx, r: b.left + (W - M.r) * kx, t: b.top + M.t * ky, b: b.top + (H - M.b) * ky };
    }
    function clampTo(p, v, ax) { return Math.min(Math.max(v, ax ? p.l : p.t), ax ? p.r : p.b); }
    function boxRect(e) {
      var p = plotClient();
      return { x0: clampTo(p, press.x, true), x1: clampTo(p, e.clientX, true), y0: clampTo(p, press.y, false), y1: clampTo(p, e.clientY, false), p: p };
    }
    function showBox(e) {
      var q = boxRect(e), fb = frame.getBoundingClientRect();
      zbox.hidden = false;
      zbox.style.left = (Math.min(q.x0, q.x1) - fb.left) + 'px'; zbox.style.top = (Math.min(q.y0, q.y1) - fb.top) + 'px';
      zbox.style.width = Math.abs(q.x1 - q.x0) + 'px'; zbox.style.height = Math.abs(q.y1 - q.y0) + 'px';
    }
    function applyBox(e) {
      var q = boxRect(e);
      if (Math.abs(q.x1 - q.x0) < 8 || Math.abs(q.y1 - q.y0) < 8) return;
      var p = q.p, ax = geom.xTop - geom.xLo, ay = geom.yTop - geom.yLo;
      function dx(c) { return geom.xLo + (c - p.l) / (p.r - p.l) * ax; }
      function dy(c) { return geom.yTop - (c - p.t) / (p.b - p.t) * ay; }
      var nv = { x0: Math.min(dx(q.x0), dx(q.x1)), x1: Math.max(dx(q.x0), dx(q.x1)), y0: Math.min(dy(q.y0), dy(q.y1)), y1: Math.max(dy(q.y0), dy(q.y1)) };
      var mx = geom.base.x1 / 1000, my = geom.base.y1 / 1000;
      if (nv.x1 - nv.x0 < mx) { var cx = (nv.x0 + nv.x1) / 2; nv.x0 = cx - mx / 2; nv.x1 = cx + mx / 2; }
      if (nv.y1 - nv.y0 < my) { var cy = (nv.y0 + nv.y1) / 2; nv.y0 = cy - my / 2; nv.y1 = cy + my / 2; }
      view = nv.x1 - nv.x0 >= geom.base.x1 && nv.y1 - nv.y0 >= geom.base.y1 ? null : nv;
      draw();
    }
    wrap.addEventListener('pointermove', function (e) {
      if (press) {
        if (press.mode === 'pan') { panTo(e); return; }
        if (!press.moved && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) < 6) return;
        press.moved = true; showBox(e);
        return;
      }
      if (follow) return;
      var i = nearest(e.clientX); if (i >= 0) setCursor(i);
    });
    /* Dragging or double-clicking on the graph must not highlight the text around it. */
    wrap.addEventListener('selectstart', function (e) { e.preventDefault(); });
    function clearSelection() { try { var sel = window.getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges(); } catch (err) { /* ignore */ } }
    wrap.addEventListener('pointerdown', function (e) {
      if (follow) return;
      clearSelection();
      var i = nearest(e.clientX); if (i >= 0) setCursor(i);
      if (e.button !== 0 || !geom || geom.log || rec().x.length < 2) return;
      press = { x: e.clientX, y: e.clientY, mode: view && !e.shiftKey ? 'pan' : 'box', moved: false, v: view ? JSON.parse(JSON.stringify(view)) : null };
      if (press.mode === 'pan') { dragging = press; wrap.classList.add('panning'); }
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    function endPan(e) {
      var p = press;
      press = null; dragging = null; wrap.classList.remove('panning'); zbox.hidden = true;
      if (p && p.mode === 'box' && p.moved && e && e.type === 'pointerup') { press = p; applyBox(e); press = null; }
    }
    wrap.addEventListener('pointerup', endPan);
    wrap.addEventListener('pointercancel', endPan);
    wrap.addEventListener('dblclick', function () { if (view) { view = null; draw(); } });
    function panTo(e) {
      var box = wrap.querySelector('svg').getBoundingClientRect(), pw = W - M.l - M.r, ph = H - M.t - M.b, v0 = dragging.v;
      var dx = (e.clientX - dragging.x) * (W / box.width) / pw * (v0.x1 - v0.x0);
      var dy = (e.clientY - dragging.y) * (H / box.height) / ph * (v0.y1 - v0.y0);
      view = { x0: v0.x0 - dx, x1: v0.x1 - dx, y0: v0.y0 + dy, y1: v0.y1 + dy };
      draw();
    }
    /* Zoom about a point of the plot area (fx, fy in 0..1 from the left/top). f < 1 zooms in. Display only. */
    function zoomAt(f, fx, fy) {
      if (!geom || geom.log || rec().x.length < 2) return;
      var x0 = geom.xLo, x1 = geom.xTop, y0 = geom.yLo, y1 = geom.yTop;
      var cx = x0 + fx * (x1 - x0), cy = y1 - fy * (y1 - y0);
      var nv = { x0: cx - (cx - x0) * f, x1: cx + (x1 - cx) * f, y0: cy - (cy - y0) * f, y1: cy + (y1 - cy) * f };
      if (nv.x1 - nv.x0 >= geom.base.x1 && nv.y1 - nv.y0 >= geom.base.y1) view = null;
      else if (nv.x1 - nv.x0 < geom.base.x1 / 1000 || nv.y1 - nv.y0 < geom.base.y1 / 1000) return;
      else view = nv;
      draw();
    }
    wrap.addEventListener('wheel', function (e) {
      if (!geom || geom.log || follow || rec().x.length < 2) return;
      var box = wrap.querySelector('svg').getBoundingClientRect();
      var fx = ((e.clientX - box.left) * (W / box.width) - M.l) / (W - M.l - M.r);
      var fy = ((e.clientY - box.top) * (H / box.height) - M.t) / (H - M.t - M.b);
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
      e.preventDefault();
      zoomAt(Math.min(2, Math.max(0.5, Math.exp(e.deltaY * 0.0015))), fx, fy);
    }, { passive: false });
    bind(root.querySelector('#z-in'), 'click', function () { zoomAt(0.7, 0.5, 0.5); });
    bind(root.querySelector('#z-out'), 'click', function () { zoomAt(1 / 0.7, 0.5, 0.5); });
    bind(root.querySelector('#z-reset'), 'click', function () { view = null; draw(); });
    bind(root.querySelector('#t-regions'), 'change', function (e) { regionsOn = e.target.checked; regionsTouched = true; draw(); });
    bind(root.querySelector('#t-tangent'), 'change', function (e) { tangentOn = e.target.checked; setCursor(idx); });
    bind(root.querySelector('#show-all'), 'click', function () { KEYS.forEach(function (q) { shown[q] = true; }); syncRows(); draw(); });
    bind(root.querySelector('#show-defs'), 'change', function (e) { root.querySelector('.graph-side').classList.toggle('show-defs', e.target.checked); });
    bind(root.querySelector('#hide-all'), 'click', function () { shown = {}; hl = null; syncRows(); draw(); });
    bind(root.querySelector('#results'), 'click', function (e) {
      var b = e.target.closest ? e.target.closest('.res-btn') : null;
      if (!b || b.disabled) return;
      var key = b.getAttribute('data-hl');
      hl = hl === key ? null : key; syncRows(); draw();
    });
    bind(root.querySelector('#results'), 'change', function (e) {
      var key = e.target.getAttribute('data-show');
      if (!key) return;
      shown[key] = e.target.checked; draw();
    });
    function keepCursorInView() {
      if (!view) return;
      var r = rec(), xv = r.x[idx], yv = r.y[idx], sp, ch = false;
      if (xv < view.x0 || xv > view.x1) { sp = view.x1 - view.x0; view.x0 = xv < view.x0 ? xv - sp * 0.1 : xv + sp * 0.1 - sp; view.x1 = view.x0 + sp; ch = true; }
      if (yv < view.y0 || yv > view.y1) { sp = view.y1 - view.y0; view.y0 = yv < view.y0 ? yv - sp * 0.1 : yv + sp * 0.1 - sp; view.y1 = view.y0 + sp; ch = true; }
      if (ch) draw();
    }
    wrap.addEventListener('keydown', function (e) {
      var n = rec().x.length, step = e.shiftKey ? 10 : 1, next = null;
      if (!n || follow) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(0.7, 0.5, 0.5); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(1 / 0.7, 0.5, 0.5); return; }
      if (view && (e.key === '[' || e.key === ']' || e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault();
        var sx2 = (view.x1 - view.x0) * 0.25, sy2 = (view.y1 - view.y0) * 0.25;
        if (e.key === '[') { view.x0 -= sx2; view.x1 -= sx2; }
        else if (e.key === ']') { view.x0 += sx2; view.x1 += sx2; }
        else if (e.key === 'PageUp') { view.y0 += sy2; view.y1 += sy2; }
        else { view.y0 -= sy2; view.y1 -= sy2; }
        draw();
        return;
      }
      if (e.key === 'ArrowRight') next = idx + step;
      else if (e.key === 'ArrowLeft') next = idx - step;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      if (next === null) return;
      e.preventDefault();
      setCursor(Math.max(0, Math.min(n - 1, next)), true);
      keepCursorInView();
    });

    /* ---------- downloads (generated in the browser) ---------- */
    function fileBase() {
      if (opts.fileBase) return opts.fileBase();
      var r = rec();
      return CFG.slug + '_' + r.material + '_' + r.source;
    }
    function save(blob, name) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }
    bind(root.querySelector('#dl-svg'), 'click', function () {
      save(new Blob([build(rec(), EXPORT, { exp: true, scale: 1.667 })], { type: 'image/svg+xml;charset=utf-8' }), fileBase() + '.svg');
    });
    bind(root.querySelector('#dl-png'), 'click', function () {
      var svg = build(rec(), EXPORT, { exp: true, scale: 3.333 });
      var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = W * 3.333; c.height = H * 3.333;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) save(b, fileBase() + '.png'); }, 'image/png');
      };
      img.src = url;
    });

    /* ---------- Excel workbook (built in the browser by excel-export.js) ---------- */
    function excelInfo() {
      var r = rec(), p = r.params, sp = p.specimen || {}, raw = r.raw, n = r.x.length;
      var details;
      if (opts.details) details = opts.details();
      else {
        var A0 = sp.width_mm * sp.thickness_mm;
        details = [['Biomaterials Tensile Tester', 'test data'], ['Test', CFG.name], ['Source', sourceTag(r)], ['Material / specimen', r.label],
          ['Gauge length L0 (mm)', sp.L0_mm], ['Width (mm)', sp.width_mm], ['Thickness (mm)', sp.thickness_mm], ['Area A0 (mm2)', isFinite(A0) ? Number(sig(A0, 6)) : '']];
        if (isRelax && p.hold_mm) details.push(['Hold displacement (mm)', sig(p.hold_mm, 6)], ['Hold duration (s)', p.hold_s]);
        if (p.temperature_C !== undefined && p.temperature_C !== '') details.push(['Temperature (C)', p.temperature_C]);
        if (p.environment) details.push(['Environment', p.environment]);
        if (p.model) details.push([r.source === 'sample' ? 'Generated from' : 'Notes', p.model]);
        details.push(['Points', n]);
        if (r.source === 'loaded') {
          var ex = [];
          if (r.materialText) ex.push(['Material in file', r.materialText]);
          if (r.specimenId) ex.push(['Specimen ID', r.specimenId]);
          if (r.fileDate) ex.push(['Recorded', r.fileDate]);
          details.splice.apply(details, [4, 0].concat(ex));
        }
      }
      var mft = isRelax || r.source === 'sample' ? '' : window.TensileGraph.modulusFitText(r);
      if (mft && !details.some(function (d) { return d[0] === 'Modulus fit interval'; })) details.push(['Modulus fit interval', mft]);
      var dst = r.source === 'sample' ? '' : dimSourceText(r);
      if (dst && !details.some(function (d) { return d[0] === 'Dimensions source'; })) details.push(['Dimensions source', dst]);
      var dcx = dataChecks(r, isRelax);
      if (dcx.text && !details.some(function (d) { return d[0] === 'Data checks'; })) details.push(['Data checks', dcx.text]);
      var cols = [];
      if (raw && raw.t && raw.t.length === n) cols.push({ name: 'time_s', values: raw.t });
      else if (isRelax) cols.push({ name: 'time_s', values: r.x });
      if (raw && raw.F && raw.F.length === n) cols.push({ name: 'force_N', values: raw.F });
      if (raw && raw.d && raw.d.length === n) cols.push({ name: 'displacement_mm', values: raw.d });
      if (!isRelax) cols.push({ name: 'strain', values: r.x });
      cols.push({ name: 'stress_MPa', values: r.y });
      var res = (isRelax ? relaxationResults(r) : uniaxialResults(r)).map(function (q) { return [plain(q[0]), plain(q[1]), plain(q[2])]; });
      return { details: details, results: res, columns: cols,
        chart: { title: defTitle() + ' (' + sourceTag(r) + ')', xName: isRelax ? 'time_s' : 'strain', yName: 'stress_MPa',
          xTitle: isRelax ? 'Time (s)' : 'Crosshead-based engineering strain, Δx/L₀ (mm/mm)', yTitle: isRelax ? 'Stress (MPa)' : 'Engineering stress, F/A₀ (MPa)', seriesName: sourceTag(r) || 'Stress' },
        note: 'Stress and strain are calculated from the recorded values. Displacement is crosshead displacement, not an extensometer measurement. Key results are calculated by this website.' };
    }
    /* Everything the printable report needs (report.js): details, key results, and the graph as currently shown. */
    function reportInfo() {
      var r = rec(), info = excelInfo();
      return { title: defTitle(), source: sourceTag(r), relax: isRelax, details: info.details, results: info.results, svg: build(r, EXPORT, { exp: true, scale: 1 }) };
    }
    bind(root.querySelector('#dl-print'), 'click', function () {
      if (rec().x.length >= 2 && window.TensileReport) window.TensileReport.printRecord(reportInfo());
    });
    bind(root.querySelector('#dl-xlsx'), 'click', function () {
      if (rec().x.length < 2) return;
      save(window.TensileExcel.build(excelInfo()), fileBase() + '.xlsx');
    });

    renderMats();
    drawMaterial();

    /* ---------- API for the page scripts ---------- */
    return {
      record: rec,
      save: save,
      reportInfo: reportInfo,
      /* Live mode: recompute from raw readings and redraw. followEnd keeps the readout on the newest point. */
      refresh: function (followEnd) {
        var r = rec();
        follow = !!followEnd;
        /* Live: regions appear by themselves when a test ends, unless the user has already chosen. */
        if (mode === 'live') {
          if (wasFollow && !follow && !regionsTouched && r.x.length >= 10) regionsOn = true;
          wasFollow = follow;
          if (follow) { hl = null; shown = {}; }
        }
        recompute(r, isRelax);
        if (followEnd) idx = Math.max(0, r.x.length - 1);
        renderResults(r);
        draw();
      },
      setRecord: function (r) {
        records = [r]; st.mat = r.material; recompute(r, isRelax);
        if (mode === 'live') { regionsOn = false; regionsTouched = false; wasFollow = false; }
        drawMaterial();
      },
      /* Example mode: limit the Material choice to these material keys (null = all). */
      setChoices: function (list) { choices = list || null; },
      hasMaterial: function (m) { return records.some(function (r) { return r.material === m; }); },
      setMaterial: function (m, lock) {
        if (records.some(function (r) { return r.material === m; })) st.mat = m;
        var fs = root.querySelector('.segmented');
        if (fs) fs.hidden = !!lock;
        renderMats(); drawMaterial();
      }
    };
  }

  window.TensileGraph = {
    configs: CONFIGS,
    mount: mount,
    fromCSV: fromCSV,
    dataChecks: dataChecks,
    holdStartFraction: HOLD_START_FRACTION,
    holdStartText: holdStartText,
    dimSourceText: dimSourceText,
    modulusFitText: function (rec) {
      var f = rec && rec.x && rec.x.length > 1 ? loadingFit(rec.x, rec.y) : null;
      return f ? fitText(rec.x, f, true).replace(/\.$/, '') : '';
    },
    sampleParams: sampleParams,
    numbers: numbers,
    sampleRegion: sampleRegion,
    sig: sig,
    keyPoints: keyPoints,
    regionsFor: regionsFor
  };
})();
