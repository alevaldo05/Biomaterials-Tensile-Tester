/* The downloaded CSV of a test (window.LiveCsv): the file name, the "# ..." header lines, and the data rows. Opens in Excel.
   Base units whatever the display settings. Moved from live.js; the record, start time, and end reason are passed in
   instead of being read from live.js's variables. live.js creates it with LiveCsv.create(spec, CFG, TG, isRelax). */
(function () {
  'use strict';
  window.LiveCsv = {
    create: function (spec, CFG, TG, isRelax) {
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function stamp(d, forFile) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (forFile ? '_' : ' ') + pad(d.getHours()) + (forFile ? '' : ':') + pad(d.getMinutes()) + (forFile ? '' : ':' + pad(d.getSeconds()));
    }
    function fileBase(rec, startedAt) {
      var s = spec(), who = (s.id || s.mat).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'test';
      return CFG.slug + '_' + who + '_' + (rec.source === 'simulated' ? 'simulated' : 'measured') + (startedAt ? '_' + stamp(startedAt, true) : '');
    }
    function cell(v) {
      var s = v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
      if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = "'" + s; /* keep Excel from treating text as a formula */
      if (/[",;\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    function n7(v) { return isFinite(v) ? String(parseFloat(v.toPrecision(7))) : ''; }
    function metaRows(rec, startedAt, endReason) {
      var s = spec(), p = rec.params, sp = p.specimen, raw = rec.raw, n = raw.t.length, A0 = sp.width_mm * sp.thickness_mm;
      var meta = [
        ['Biomaterials Tensile Tester', 'test data'],
        ['Test', CFG.name],
        ['Source', rec.source === 'simulated' ? 'simulated (not measured)' : 'measured'],
        ['Material', s.matLabel],
        ['Specimen ID', s.id],
        ['Date', startedAt ? stamp(startedAt) : ''],
        ['Gauge length L0 (mm)', sp.L0_mm],
        ['Width (mm)', sp.width_mm],
        ['Thickness (mm)', sp.thickness_mm],
        ['Area A0 (mm2)', n7(A0)],
        ['Crosshead speed (mm/min)', p.speed_mm_min]
      ];
      if (isRelax) meta.push(['Hold displacement (mm)', p.hold_mm], ['Hold duration (s)', p.hold_s]);
      meta.push(['Temperature (C)', s.temp], ['Environment', s.env], ['Notes', s.notes], ['End of test', endReason], ['Points', n]);
      var hst = isRelax ? TG.holdStartText(rec) : '';
      if (hst) meta.push(['Hold start', hst]);
      var mfit = isRelax ? '' : TG.modulusFitText(rec);
      if (mfit) meta.push(['Modulus fit interval', mfit]);
      var dsrc = TG.dimSourceText(rec);
      if (dsrc) meta.push(['Dimensions source', dsrc]);
      var dq = TG.dataChecks(rec, isRelax);
      if (dq.text) meta.push(['Data checks', dq.text]);
      return meta;
    }
    function buildCSV(rec, startedAt, endReason) {
      var s = spec(), p = rec.params, sp = p.specimen, raw = rec.raw, n = raw.t.length, A0 = sp.width_mm * sp.thickness_mm;
      var out = metaRows(rec, startedAt, endReason).map(function (m) { return '# ' + m[0] + ',' + cell(m[1]); });
      out.push('time_s,force_N,displacement_mm,strain,stress_MPa');
      for (var i = 0; i < n; i++) {
        out.push([n7(raw.t[i]), n7(raw.F[i]), n7(raw.d[i]), n7(raw.d[i] / sp.L0_mm), n7(raw.F[i] / A0)].join(','));
      }
      return '﻿' + out.join('\r\n') + '\r\n';
    }

      return { fileBase: fileBase, metaRows: metaRows, build: buildCSV };
    }
  };
})();
