/* Graph calculations and CSV reading (window.TensileGraphCore). The numbers behind the graph pages: display choices (stress unit,
   strain unit, digits), records, key results (modulus, yield, UTS, relaxation), key points and regions, data checks, where the
   dimensions came from, and reading a CSV file. Nothing here draws anything or touches the page.
   graph.js (the interactive graph) and every page that uses it load this file first. Pure move from graph.js: no change to any calculation. */
(function () {
  'use strict';

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
    (meta.all = meta.all || []).push([m[1].replace(/"/g, '').trim(), val]);
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
      specimenId: meta.id || '', materialText: meta.material || '', fileDate: meta.date || '', fileMeta: meta.all || [] };
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


  window.TensileGraphCore = {
    HOLD_START_FRACTION: HOLD_START_FRACTION,
    area: area,
    axisLabel: axisLabel,
    clone: clone,
    dataChecks: dataChecks,
    dimIsExample: dimIsExample,
    dimSourceText: dimSourceText,
    dsig: dsig,
    esc: esc,
    fitText: fitText,
    fmtStrain: fmtStrain,
    fmtStress: fmtStress,
    fromCSV: fromCSV,
    holdStartText: holdStartText,
    initSample: initSample,
    keyPoints: keyPoints,
    loadingFit: loadingFit,
    matKeyOf: matKeyOf,
    maxOf: maxOf,
    niceTicks: niceTicks,
    numbers: numbers,
    peakIndex: peakIndex,
    recompute: recompute,
    regionsFor: regionsFor,
    relaxationResults: relaxationResults,
    sampleParams: sampleParams,
    sampleRegion: sampleRegion,
    sig: sig,
    sourceTag: sourceTag,
    strainFactor: strainFactor,
    strainPct: strainPct,
    stressScale: stressScale,
    stressUnit: stressUnit,
    uniaxialResults: uniaxialResults
  };
})();
