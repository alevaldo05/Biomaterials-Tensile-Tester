/* Live test page: connects to the tester (USB through Web Serial, or the built-in simulator), sends
   commands, records readings, plots them while the test runs, and downloads the data as a CSV file that
   opens in Excel. Data stays in this browser tab until you download it; nothing is uploaded or saved.
   The message format lives in data/device.js. The graph comes from graph.js (window.TensileGraph). */
(function () {
  'use strict';

  var app = document.getElementById('live-app');
  var TG = window.TensileGraph, DEV = window.DEVICE;
  if (!app || !TG || !DEV) return;
  var test = app.getAttribute('data-test'), isRelax = test === 'relaxation', CFG = TG.configs[test];
  var sig = TG.sig;
  /* Materials come from data/materials.js. A material is offered when this test has a sample curve for it
     (the simulator needs one); stress relaxation therefore offers skin, mild steel, and concrete only. */
  var MATS = {}, MAT_GROUPS = [];
  (window.MATERIAL_FAMILIES || []).forEach(function (f) {
    var list = (window.MATERIALS || []).filter(function (m) {
      return m.family === f.id && (window.SAMPLE_DATA || []).some(function (r) { return r.test === test && r.material === m.sample; });
    });
    list.forEach(function (m) { MATS[m.id] = [m.name, m.sample]; });
    if (list.length) MAT_GROUPS.push({ name: f.name, items: list });
  });
  MATS.other = ['Other', 'biomaterial'];
  function matOptions() {
    return MAT_GROUPS.map(function (g) {
      return '<optgroup label="' + esc(g.name) + '">' + g.items.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '<option value="other">Other</option>';
  }
  var hasSerial = 'serial' in navigator;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function field(id, label, attrs) {
    return '<label class="pf"><span>' + label + '</span><input id="' + id + '" ' + (attrs || 'type="number" min="0" step="any" inputmode="decimal"') + '></label>';
  }

  /* ---------- page layout ---------- */
  app.innerHTML =
    '<div class="live-layout">' +
      '<form class="panel" id="spec" novalidate aria-labelledby="spec-title">' +
        '<h2 id="spec-title">Specimen and settings</h2>' +
        '<label class="pf"><span>Material</span><select id="s-mat">' + matOptions() + '</select></label>' +
        field('s-id', 'Specimen ID', 'type="text" autocomplete="off"') +
        field('s-L0', 'Gauge length, L<sub>0</sub> (mm)') +
        field('s-W', 'Width (mm)') +
        field('s-T', 'Thickness (mm)') +
        '<div class="pf"><span>Area, A<sub>0</sub> (mm²)</span><output id="s-A">—</output></div>' +
        field('s-speed', 'Crosshead speed (mm/min)') +
        (isRelax ?
          field('s-hold', 'Hold displacement, ΔL (mm)') +
          '<div class="pf"><span>Hold strain, ε<sub>0</sub> = ΔL/L<sub>0</sub></span><output id="s-e0">—</output></div>' +
          field('s-holds', 'Hold duration (s)') : '') +
        field('s-temp', 'Temperature (°C)', 'type="text" inputmode="decimal" autocomplete="off"') +
        field('s-env', 'Environment', 'type="text" autocomplete="off"') +
        '<label class="pf"><span>Notes</span><textarea id="s-notes" rows="2"></textarea></label>' +
        '<p class="small"><button type="button" class="btn-link" id="s-example">Fill example values</button></p>' +
        '<p class="small muted">Example values come from the labeled sample data. Replace them with your specimen’s measured dimensions.</p>' +
      '</form>' +
      '<div class="live-main">' +
        '<div class="control-bar">' +
          '<p class="conn"><span class="dot" id="c-dot" aria-hidden="true"></span><strong id="c-text">Not connected</strong> <span class="muted" id="c-now"></span></p>' +
          '<div class="graph-actions">' +
            '<button type="button" class="btn-secondary" id="c-usb">Connect to tester (USB)</button>' +
            '<button type="button" class="btn-secondary" id="c-sim">Use simulator</button>' +
            '<button type="button" class="btn-secondary" id="c-off" hidden>Disconnect</button>' +
          '</div>' +
          (hasSerial ? '' : '<p class="small muted">USB serial requires a supporting desktop browser, a secure context, permission for the selected port, and compatible controller software. In this project, USB works in Chrome only; this browser does not offer it here. The simulator works here.</p>') +
          '<div class="run-bar">' +
            '<button type="button" class="btn-secondary" id="r-tare">Tare</button>' +
            '<button type="button" class="btn btn-start" id="r-start">Start test</button>' +
            '<button type="button" class="btn-stop" id="r-stop">STOP — sends a stop command</button>' +
            '<label class="check"><input type="checkbox" id="r-auto" checked> ' + (isRelax ? 'Auto-stop at end of hold' : 'Send STOP after detected force drop') + '</label>' +
          '</div>' +
          '<p class="small muted">Esc also sends STOP while connected. <a href="help.html">Help and keyboard keys</a></p>' +
          '<p class="csv-msg" id="r-msg" role="status"></p>' +
          '<p class="small muted" id="r-info"></p>' +
        '</div>' +
        '<div id="graph-app"></div>' +
      '</div>' +
    '</div>';

  function $(id) { return document.getElementById(id); }
  var msgEl = $('r-msg'), infoEl = $('r-info');
  function msg(text, isError) {
    msgEl.textContent = text;
    msgEl.className = 'csv-msg' + (isError ? ' error' : '');
  }

  /* ---------- specimen form ---------- */
  function num(id) { var e = $(id); if (!e) return null; var v = parseFloat(String(e.value).replace(',', '.')); return v > 0 ? v : null; }
  function spec() {
    var m = $('s-mat').value;
    return {
      mat: m, matLabel: MATS[m][0], matKey: MATS[m][1], id: $('s-id').value.trim(),
      L0: num('s-L0'), W: num('s-W'), T: num('s-T'), speed: num('s-speed'),
      hold_mm: isRelax ? num('s-hold') : null, hold_s: isRelax ? num('s-holds') : null,
      temp: $('s-temp').value.trim(), env: $('s-env').value.trim(), notes: $('s-notes').value.trim()
    };
  }
  function newRecord(source) {
    var r = { id: 'live', test: test, material: 'live', label: 'New test', source: source,
      units: { x: isRelax ? 's' : '-', y: 'MPa' },
      params: { yield: false, specimen: { L0_mm: NaN, width_mm: NaN, thickness_mm: NaN }, hold_mm: NaN, hold_strain: NaN, hold_s: NaN },
      raw: { t: [], d: [], F: [] }, x: [], y: [] };
    applySpec(r);
    r.dimSource = dimSourceNow();
    return r;
  }
  function applySpec(r) {
    var s = spec(), p = r.params;
    if (s.L0) p.specimen.L0_mm = s.L0;
    if (s.W) p.specimen.width_mm = s.W;
    if (s.T) p.specimen.thickness_mm = s.T;
    if (isRelax) { if (s.hold_mm) p.hold_mm = s.hold_mm; if (s.hold_s) p.hold_s = s.hold_s; }
    p.yield = !isRelax && !!(TG.sampleParams(test, s.matKey) || {}).yield;
    r.mk = TG.sampleRegion(test, s.matKey);
    p.speed_mm_min = s.speed; p.temperature_C = s.temp; p.environment = s.env;
    if (!running) r.label = s.matLabel + (s.id ? ' · ' + s.id : '');
  }
  function updateOutputs() {
    var s = spec();
    $('s-A').textContent = s.W && s.T ? sig(s.W * s.T, 4) : '—';
    if (isRelax) $('s-e0').textContent = s.hold_mm && s.L0 ? sig(s.hold_mm / s.L0, 4) : '—';
  }
  var REQUIRED = [['s-L0', 'gauge length'], ['s-W', 'width'], ['s-T', 'thickness'], ['s-speed', 'crosshead speed']]
    .concat(isRelax ? [['s-hold', 'hold displacement'], ['s-holds', 'hold duration']] : []);
  function validate() {
    var missing = [];
    REQUIRED.forEach(function (q) {
      var ok = num(q[0]) !== null;
      if (ok) $(q[0]).removeAttribute('aria-invalid'); else { $(q[0]).setAttribute('aria-invalid', 'true'); missing.push(q); }
    });
    return missing;
  }
  /* The three numbers "Fill example values" wrote, so a test started with exactly those is labeled as example values. */
  var exampleDims = null;
  function dimSourceNow() {
    return exampleDims && num('s-L0') === exampleDims.L0 && num('s-W') === exampleDims.W && num('s-T') === exampleDims.T ? 'example' : 'typed';
  }
  $('s-example').addEventListener('click', function () {
    var s = spec(), p = TG.sampleParams(test, s.matKey), u = TG.sampleParams('uniaxial', s.matKey);
    if (!p) return;
    $('s-L0').value = p.specimen.L0_mm; $('s-W').value = p.specimen.width_mm; $('s-T').value = p.specimen.thickness_mm;
    exampleDims = { L0: num('s-L0'), W: num('s-W'), T: num('s-T') };
    $('s-speed').value = sig(u.rate_per_s * u.specimen.L0_mm * 60, 3);
    if (isRelax) { $('s-hold').value = sig(p.hold_mm, 4); $('s-holds').value = p.hold_s; }
    REQUIRED.forEach(function (q) { $(q[0]).removeAttribute('aria-invalid'); });
    updateOutputs(); applySpec(rec); api.refresh(running);
    msg('Example values filled in (from the sample data). Replace them with your specimen’s measured dimensions.');
  });
  $('spec').addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') && num(e.target.id) !== null) e.target.removeAttribute('aria-invalid');
    updateOutputs(); applySpec(rec); api.refresh(running);
  });

  /* ---------- connections ---------- */
  /* USB serial (Web Serial). Every connection type offers: open(), send(line), close(), onLine, onClose.
     A Wi-Fi connection can be added later with the same five members. */
  function SerialLink() { this.kind = 'usb'; this.port = null; this.reader = null; this.closing = false; this.queue = Promise.resolve(); }
  SerialLink.prototype.open = function () {
    var self = this;
    return navigator.serial.requestPort().then(function (port) {
      self.port = port;
      return port.open({ baudRate: DEV.baudRate });
    }).then(function () { self.loop = self.readLoop(); });
  };
  SerialLink.prototype.readLoop = async function () {
    var dec = new TextDecoder(), buf = '';
    while (this.port.readable && !this.closing) {
      this.reader = this.port.readable.getReader();
      var done = false;
      try {
        for (;;) {
          var res = await this.reader.read();
          if (res.done) { done = true; break; }
          buf += dec.decode(res.value, { stream: true });
          var parts = buf.split(/\r?\n|\r/);
          buf = parts.pop();
          for (var i = 0; i < parts.length; i++) if (this.onLine) this.onLine(parts[i]);
        }
      } catch (e) {
        /* Errors such as a framing error are not fatal; a lost device leaves port.readable empty. */
      } finally {
        try { this.reader.releaseLock(); } catch (e2) { /* already released */ }
        this.reader = null;
      }
      if (done) break;
    }
    if (!this.closing && this.onClose) this.onClose('The USB connection was lost.');
  };
  SerialLink.prototype.send = function (line) {
    var self = this;
    var p = this.queue.then(async function () {
      var w = self.port.writable.getWriter();
      try { await w.write(new TextEncoder().encode(line + DEV.lineEnding)); } finally { w.releaseLock(); }
    });
    this.queue = p.catch(function () {});
    return p;
  };
  SerialLink.prototype.close = async function () {
    this.closing = true;
    try { if (this.reader) await this.reader.cancel(); } catch (e) { /* ignore */ }
    try { await this.loop; } catch (e) { /* ignore */ }
    try { await this.queue; } catch (e) { /* ignore */ }
    try { await this.port.close(); } catch (e) { /* ignore */ }
  };

  /* Simulator: behaves like the controller described in data/device.js (same commands, same reading
     lines), using the shape of the labeled sample curves. Everything it produces is marked simulated. */
  /* Steel samples densely at small strain (u * u) so its narrow elastic region gets enough points. */
  function SimLink(getSpec) { this.kind = 'sim'; this.getSpec = getSpec; this.offset = 0.04; this.pos = 0; this.clock = 0; this.job = null; this.idle = null; }
  function noise() { return Math.random() + Math.random() + Math.random() - 1.5; }
  function interp(X, Y, v) {
    if (v <= X[0]) return Y[0];
    if (v >= X[X.length - 1]) return null;
    var lo = 0, hi = X.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (X[mid] <= v) lo = mid; else hi = mid; }
    return Y[lo] + (Y[hi] - Y[lo]) * (v - X[lo]) / (X[hi] - X[lo]);
  }
  function sampleCurve(t, mk) {
    var all = window.SAMPLE_DATA || [];
    return all.filter(function (r) { return r.test === t && r.material === mk; })[0] || all.filter(function (r) { return r.test === t; })[0];
  }
  SimLink.prototype.open = function () {
    var self = this;
    this.idle = setInterval(function () {
      if (!self.job) self.emit(self.clock, self.offset + 0.01 * noise(), self.pos);
      self.clock += 200;
    }, 200);
    return Promise.resolve();
  };
  SimLink.prototype.emit = function (tMs, F, d) {
    var cells = [], c = DEV.columns, sc = DEV.scale;
    cells[c.time] = String(Math.round(tMs / 1000 / sc.time * 1000) / 1000);
    cells[c.force] = (F / sc.force).toFixed(4);
    cells[c.displacement] = (d / sc.displacement).toFixed(5);
    if (this.onLine) this.onLine(cells.join(','));
  };
  SimLink.prototype.halt = function () { if (this.job) { clearInterval(this.job); this.job = null; } };
  SimLink.prototype.send = function (line) {
    var self = this, c = String(line).split(','), cmd = c[0].trim().toUpperCase();
    if (cmd === 'STOP') this.halt();
    else if (cmd === 'TARE') this.offset = 0;
    else if (cmd === 'START' && !this.job) {
      var s = this.getSpec(), A = s.W * s.T, k = 0, t0 = this.clock, v = (s.speed || 1) / 60;
      this.pos = 0;
      if (!isRelax) {
        var cu = sampleCurve('uniaxial', s.matKey), xEnd = cu.x[cu.x.length - 1] * 1.06, peak = Math.max.apply(null, cu.y) * A, N = 500;
        this.job = setInterval(function () {
          k++;
          var u = k / N, eps = xEnd * (s.matKey === 'steel' ? u * u : u), sgm = interp(cu.x, cu.y, eps), d = eps * s.L0;
          var F = (sgm === null ? 0 : sgm) * A + 0.001 * peak * noise() + self.offset;
          self.pos = d; self.clock = t0 + d / v * 1000;
          self.emit(self.clock, F, d);
          if (k >= N) { self.halt(); if (self.onLine) self.onLine(DEV.messages.done); }
        }, 40);
      } else {
        var cr = sampleCurve('relaxation', s.matKey), y0 = cr.y[0], e0 = s.hold_mm / s.L0;
        var s0 = y0 * e0 / cr.params.hold_strain, ramp = s.hold_mm / v, R = 60, Hn = 480;
        this.job = setInterval(function () {
          k++;
          var F, d, ts;
          if (k <= R) { var f = k / R; d = s.hold_mm * f; F = s0 * f * A; ts = ramp * f; }
          else {
            var u = (k - R) / Hn, th = s.hold_s * u * u, g = interp(cr.x, cr.y, th);
            d = s.hold_mm; F = s0 * (g === null ? cr.y[cr.y.length - 1] : g) / y0 * A; ts = ramp + th;
          }
          F += 0.001 * s0 * A * noise() + self.offset;
          self.pos = d; self.clock = t0 + ts * 1000;
          self.emit(self.clock, F, d);
          if (k >= R + Hn) { self.halt(); if (self.onLine) self.onLine(DEV.messages.done); }
        }, 40);
      }
    }
    return Promise.resolve();
  };
  SimLink.prototype.close = function () { this.halt(); clearInterval(this.idle); return Promise.resolve(); };

  /* ---------- state ---------- */
  var link = null, running = false, hasData = false, downloaded = true;
  var t0 = null, d0 = null, peakF = 0, holdStart = null, skipped = 0, startedAt = null, endReason = '', heartbeat = null;
  /* a link such as test-uniaxial-tension.html#al-6061 (from the Materials page) preselects that material */
  (function () {
    var h = (location.hash || '').replace('#', ''), sel = document.getElementById('s-mat');
    if (sel && Object.prototype.hasOwnProperty.call(MATS, h)) sel.value = h;
  })();
  var rec = newRecord('none');
  var graphRoot = $('graph-app');
  var api = TG.mount(graphRoot, {
    test: test, mode: 'live', record: rec,
    emptyText: 'Waiting for data – connect to the tester and press Start',
    fileBase: fileBase,
    details: function () { return metaRows(); }
  });

  function ui() {
    var on = !!link;
    $('c-usb').hidden = on; $('c-sim').hidden = on;
    $('c-usb').disabled = !hasSerial;
    $('c-off').hidden = !on; $('c-off').disabled = running;
    $('r-tare').disabled = !on || running;
    $('r-start').disabled = !on || running;
    $('r-stop').disabled = !on;
    $('dl-csv').disabled = running || !hasData;
    if ($('r-print')) $('r-print').disabled = running || !hasData;
    ['s-mat', 's-speed', 's-hold', 's-holds', 's-example'].forEach(function (id) { if ($(id)) $(id).disabled = running; });
    $('c-dot').className = 'dot' + (running ? ' run' : on ? ' on' : '');
    $('c-text').textContent = !on ? 'Not connected' : (running ? 'Recording · ' : 'Connected · ') + (link.kind === 'sim' ? 'simulator (not measured)' : 'tester (USB)');
    if (!on) $('c-now').textContent = '';
  }

  /* ---------- readings from the tester ---------- */
  function toNum(s) { s = String(s === undefined ? '' : s).trim(); return s === '' ? NaN : Number(s); }
  var lastNow = 0;
  function onLine(line) {
    var s = String(line).trim();
    if (!s) return;
    var up = s.toUpperCase();
    if (up === DEV.messages.done) { if (running) finish('The tester reported the test is complete.'); return; }
    if (up.indexOf(DEV.messages.errorPrefix) === 0) {
      if (running) finish('Tester error: ' + s.slice(0, 160) + '. Recording stopped.', true);
      else msg('Tester error: ' + s.slice(0, 160), true);
      return;
    }
    var parts = s.split(/[,;\t]/), c = DEV.columns, sc = DEV.scale;
    var t = toNum(parts[c.time]) * sc.time, F = toNum(parts[c.force]) * sc.force, d = toNum(parts[c.displacement]) * sc.displacement;
    if (!isFinite(t) || !isFinite(F) || !isFinite(d)) {
      if (running) skipped++;
      infoEl.textContent = 'Message from tester: ' + s.slice(0, 160);
      return;
    }
    var now = performance.now();
    if (now - lastNow > 150) { lastNow = now; $('c-now').textContent = '· Force ' + sig(F, 4) + ' N · Displacement ' + sig(d, 4) + ' mm'; }
    if (!running) return;
    if (t0 === null) { t0 = t; d0 = d; }
    var raw = rec.raw;
    raw.t.push(t - t0); raw.d.push(d - d0); raw.F.push(F);
    if (!hasData) { hasData = true; downloaded = false; }
    var n = raw.t.length;
    if (!isRelax) {
      if (F > peakF) peakF = F;
      if ($('r-auto').checked && peakF >= DEV.breakDetect.minPeakForce_N && F < DEV.breakDetect.dropFraction * peakF) {
        stopTest('Force drop detected: force fell below ' + Math.round(DEV.breakDetect.dropFraction * 100) + '% of its peak. STOP sent.');
        return;
      }
    } else {
      var hm = rec.params.hold_mm;
      if (holdStart === null && hm > 0 && d - d0 >= TG.holdStartFraction * hm) holdStart = t - t0;
      if ($('r-auto').checked && holdStart !== null && t - t0 - holdStart >= rec.params.hold_s) { stopTest('Hold complete. STOP sent.'); return; }
    }
    if (n >= DEV.maxPoints) { stopTest('Point limit (' + DEV.maxPoints + ') reached. STOP sent.'); return; }
    schedule();
  }
  var pending = false, lastDraw = 0;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      requestAnimationFrame(function () { pending = false; lastDraw = performance.now(); api.refresh(running); });
    }, Math.max(0, 50 - (performance.now() - lastDraw)));
  }

  /* ---------- commands ---------- */
  function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined && v[k] !== null ? String(v[k]) : m; }); }
  function sendCmd(cmd) {
    if (!link || !cmd) return;
    link.send(cmd).catch(function (e) { msg('Could not send ' + cmd + ' to the tester: ' + (e && e.message ? e.message : e), true); });
  }
  function startTest() {
    var missing = validate();
    if (missing.length) {
      msg('Enter the ' + missing.map(function (q) { return q[1]; }).join(', ') + ' before starting.', true);
      $(missing[0][0]).focus();
      return;
    }
    if (hasData && !downloaded && !window.confirm('Start a new test? The current data has not been downloaded and will be cleared.')) return;
    if (checklistOn()) { showChecklist(begin); return; }
    begin();
  }

  /* ---------- pre-test checklist (only when Settings > Pre-test checklist is On; data/checklist.js) ---------- */
  function checklistOn() { return document.documentElement.getAttribute('data-checklist') === 'on' && !!window.PRETEST_CHECKLIST; }
  /* Tissue items are shown for biological materials (and "Other"); steel, plastics, and so on skip them. */
  function isTissueMaterial() {
    var m = window.MATERIAL_BY_ID && window.MATERIAL_BY_ID[$('s-mat').value];
    return !m || m.family === 'bio';
  }
  var checklistDlg = null;
  function showChecklist(onConfirm) {
    var C = window.PRETEST_CHECKLIST, tissue = isTissueMaterial();
    var groups = C.groups.map(function (g) { return { name: g.name, items: g.items.filter(function (it) { return !it.tissue || tissue; }) }; });
    var total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) {
      /* very old browser without <dialog>: a plain confirmation that lists the same items */
      var lines = groups.map(function (g) { return g.name + ':\n' + g.items.map(function (it) { return ' - ' + it.text; }).join('\n'); }).join('\n\n');
      if (window.confirm(C.title + '\n\n' + lines + '\n\nHave you done all of these?')) onConfirm();
      return;
    }
    if (!checklistDlg) {
      checklistDlg = document.createElement('dialog');
      checklistDlg.className = 'pretest';
      checklistDlg.setAttribute('aria-labelledby', 'pt-title');
      /* Esc only closes this pop-up; it must not also reach the page's Esc-sends-STOP shortcut */
      checklistDlg.addEventListener('keydown', function (e) { if (e.key === 'Escape') e.stopPropagation(); });
      document.body.appendChild(checklistDlg);
    }
    var dlg = checklistDlg;
    dlg.innerHTML =
      '<h2 id="pt-title">' + esc(C.title) + (C.badge ? ' <span class="badge">' + esc(C.badge) + '</span>' : '') + '</h2>' +
      '<p class="pt-note">' + esc(C.note) + '</p>' +
      groups.map(function (g) {
        return '<h3>' + esc(g.name) + '</h3><ul class="pt-list">' + g.items.map(function (it) {
          return '<li><label><input type="checkbox"> <span>' + esc(it.text) + '</span></label></li>';
        }).join('') + '</ul>';
      }).join('') +
      '<p class="pt-count" id="pt-count" aria-live="polite"></p>' +
      '<div class="pt-actions"><button type="button" class="btn" id="pt-go" disabled>Start test</button>' +
      '<button type="button" class="btn-secondary" id="pt-cancel">Cancel</button></div>';
    var boxes = [].slice.call(dlg.querySelectorAll('input[type="checkbox"]')), go = dlg.querySelector('#pt-go');
    function update() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      go.disabled = n < total;
      dlg.querySelector('#pt-count').textContent = n + ' of ' + total + ' ticked' + (n < total ? '. Start is available when all are ticked.' : '.');
    }
    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();
    go.addEventListener('click', function () { dlg.close(); $('r-start').focus(); onConfirm(); });
    dlg.querySelector('#pt-cancel').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () { if (document.activeElement === document.body) $('r-start').focus(); }, { once: true });
    dlg.showModal();
  }

  function begin() {
    if (!link) { msg('Not connected. Connect to the tester or use the simulator, then press Start.', true); return; }
    var s = spec();
    rec = newRecord(link.kind === 'sim' ? 'simulated' : 'measured');
    api.setRecord(rec);
    t0 = d0 = null; peakF = 0; holdStart = null; skipped = 0; hasData = false; downloaded = true;
    startedAt = new Date(); endReason = ''; infoEl.textContent = '';
    running = true;
    ui();
    sendCmd(isRelax ? fill(DEV.commands.startRelaxation, { speed: s.speed, hold_mm: s.hold_mm, hold_s: s.hold_s }) : fill(DEV.commands.startUniaxial, { speed: s.speed }));
    if (DEV.commands.heartbeat && DEV.heartbeatMs) heartbeat = setInterval(function () { sendCmd(DEV.commands.heartbeat); }, DEV.heartbeatMs);
    msg('Test running' + (link.kind === 'sim' ? ' (simulated)' : '') + '. Press STOP or Esc to stop.');
  }
  function finish(reason, isError) {
    running = false;
    clearInterval(heartbeat); heartbeat = null;
    endReason = reason;
    rec.skippedLines = skipped;
    api.refresh(false);
    var n = rec.raw.t.length;
    msg(reason + ' ' + (n ? n + ' points recorded' + (skipped ? ' (' + skipped + ' unreadable lines skipped)' : '') + '. Download the data before you leave this page.' : 'No readings were recorded.'), isError);
    ui();
  }
  function stopTest(reason) {
    sendCmd(DEV.commands.stop);
    if (running) finish(reason || 'Stopped. STOP sent.');
    else msg('STOP sent.');
  }

  function attach(l) {
    link = l;
    l.onLine = onLine;
    l.onClose = function (why) {
      link = null;
      if (running) finish(why + ' Recording stopped; the data so far is kept.', true);
      else msg(why, true);
      ui();
    };
    ui();
  }
  $('c-usb').addEventListener('click', function () {
    var l = new SerialLink();
    l.open().then(function () {
      attach(l);
      msg('Connected to the tester over USB. Press Tare with no load on the specimen, then Start.');
    }).catch(function (e) {
      if (e && e.name === 'NotFoundError') msg('No port was selected.');
      else msg('Could not connect: ' + (e && e.message ? e.message : e), true);
    });
  });
  $('c-sim').addEventListener('click', function () {
    var l = new SimLink(spec);
    l.open().then(function () {
      attach(l);
      msg('Simulator connected. Its readings are simulated, not measured. Enter the specimen values (or Fill example values), then press Start.');
    });
  });
  $('c-off').addEventListener('click', function () {
    if (running || !link) return;
    var l = link;
    link = null;
    ui();
    l.close().then(function () { msg('Disconnected.'); });
  });
  $('r-tare').addEventListener('click', function () { sendCmd(DEV.commands.tare); msg('TARE sent: force zeroed.'); });
  $('r-start').addEventListener('click', startTest);
  $('r-stop').addEventListener('click', function () { stopTest('Stopped by you. STOP sent.'); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && link) { stopTest('Stopped with Esc. STOP sent.'); }
  });
  $('s-mat').addEventListener('change', function () { applySpec(rec); api.refresh(running); });

  /* ---------- CSV download (opens in Excel) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d, forFile) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (forFile ? '_' : ' ') + pad(d.getHours()) + (forFile ? '' : ':') + pad(d.getMinutes()) + (forFile ? '' : ':' + pad(d.getSeconds()));
  }
  function fileBase() {
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
  function metaRows() {
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
  function buildCSV() {
    var s = spec(), p = rec.params, sp = p.specimen, raw = rec.raw, n = raw.t.length, A0 = sp.width_mm * sp.thickness_mm;
    var out = metaRows().map(function (m) { return '# ' + m[0] + ',' + cell(m[1]); });
    out.push('time_s,force_N,displacement_mm,strain,stress_MPa');
    for (var i = 0; i < n; i++) {
      out.push([n7(raw.t[i]), n7(raw.F[i]), n7(raw.d[i]), n7(raw.d[i] / sp.L0_mm), n7(raw.F[i] / A0)].join(','));
    }
    return '﻿' + out.join('\r\n') + '\r\n';
  }
  var dl = document.createElement('button');
  dl.type = 'button'; dl.className = 'btn-secondary'; dl.id = 'dl-csv'; dl.textContent = 'Download data (CSV for Excel)';
  graphRoot.querySelector('#g-actions').insertBefore(dl, graphRoot.querySelector('#g-actions').firstChild);
  /* Print report: a one-page report of the finished test (report.js) */
  if (window.TensileReport) {
    var pr = document.createElement('button');
    pr.type = 'button'; pr.className = 'btn-secondary'; pr.id = 'r-print'; pr.textContent = 'Print report';
    dl.parentNode.insertBefore(pr, dl.nextSibling);
    pr.addEventListener('click', function () {
      if (!running && hasData) window.TensileReport.printRecord(api.reportInfo());
    });
  }
  dl.addEventListener('click', function () {
    api.save(new Blob([buildCSV()], { type: 'text/csv;charset=utf-8' }), fileBase() + '.csv');
    downloaded = true;
    msg('Data downloaded as ' + fileBase() + '.csv. Open it in Excel, or reopen it later with Load Test.');
  });

  window.addEventListener('beforeunload', function (e) {
    if (running || (hasData && !downloaded)) { e.preventDefault(); e.returnValue = ''; }
  });

  updateOutputs();
  ui();
})();
